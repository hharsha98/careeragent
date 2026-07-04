"""The three agent patterns, hand-rolled on purpose (no framework):

1. complete()      — one chat call with PROVIDER FALLBACK: try Groq (fast),
                     fall back to Mistral if Groq is down or rate-limited.
2. complete_json() — STRUCTURED OUTPUT: force JSON mode, validate against a
                     Pydantic model, retry once with the validation error.
3. run_tool_loop() — the TOOL LOOP: a while loop around function-calling.
                     The model asks to run a tool; we run it, append the
                     result, and call the model again until it answers.
"""
import json

from openai import OpenAI
from pydantic import BaseModel, ValidationError

from app.config import settings


def _groq() -> OpenAI:
    return OpenAI(api_key=settings.groq_api_key, base_url=settings.groq_base_url)


def _mistral() -> OpenAI:
    return OpenAI(api_key=settings.mistral_api_key, base_url=settings.mistral_base_url)


class Usage:
    """Accumulates token counts across the several calls one agent run makes."""

    def __init__(self):
        self.tokens_in = 0
        self.tokens_out = 0
        self.model = settings.agent_model  # last model that answered

    def add(self, response):
        if getattr(response, "usage", None):
            self.tokens_in += response.usage.prompt_tokens
            self.tokens_out += response.usage.completion_tokens
        self.model = response.model


def complete(messages, usage: Usage, tools=None, response_format=None):
    """One chat completion. Groq first, Mistral on any failure (429, outage)."""
    kwargs = dict(messages=messages, temperature=0)
    if tools:
        kwargs["tools"] = tools
    if response_format:
        kwargs["response_format"] = response_format
    try:
        resp = _groq().chat.completions.create(model=settings.agent_model, **kwargs)
    except Exception:
        # Groq unavailable or rate-limited — same request, different provider.
        resp = _mistral().chat.completions.create(model=settings.chat_model, **kwargs)
    usage.add(resp)
    return resp


def complete_json(system: str, user: str, schema: type[BaseModel], usage: Usage):
    """Get a response that VALIDATES against `schema`. One retry on bad JSON."""
    messages = [
        {"role": "system",
         "content": system + "\n\nRespond with a single JSON object matching this schema:\n"
                    + json.dumps(schema.model_json_schema(), indent=2)},
        {"role": "user", "content": user},
    ]
    resp = complete(messages, usage, response_format={"type": "json_object"})
    content = resp.choices[0].message.content
    try:
        return schema.model_validate_json(content)
    except ValidationError as e:
        # Tell the model exactly what was wrong and let it fix itself — once.
        messages += [
            {"role": "assistant", "content": content},
            {"role": "user", "content": f"That JSON failed validation:\n{e}\nReturn a corrected JSON object only."},
        ]
        resp = complete(messages, usage, response_format={"type": "json_object"})
        return schema.model_validate_json(resp.choices[0].message.content)


def run_tool_loop(messages, tools_spec, tool_impls: dict, usage: Usage, max_rounds: int = 4):
    """THE tool loop. Returns the model's final text answer.

    Each round: model either answers (we're done) or asks for tool calls.
    We execute them, append results as 'tool' messages, and go again.
    max_rounds caps cost — an agent that can't finish in 4 rounds won't finish in 40.
    """
    for _ in range(max_rounds):
        resp = complete(messages, usage, tools=tools_spec)
        msg = resp.choices[0].message
        if not msg.tool_calls:
            return msg.content  # the model is done researching

        messages.append({"role": "assistant", "content": msg.content,
                         "tool_calls": [tc.model_dump() for tc in msg.tool_calls]})
        for tc in msg.tool_calls:
            fn = tool_impls[tc.function.name]
            args = json.loads(tc.function.arguments)
            result = fn(**args)
            messages.append({"role": "tool", "tool_call_id": tc.id,
                             "content": json.dumps(result)})

    # Out of rounds: force a final answer without tools.
    messages.append({"role": "user", "content": "Stop searching. Answer now with what you have."})
    resp = complete(messages, usage)
    return resp.choices[0].message.content
