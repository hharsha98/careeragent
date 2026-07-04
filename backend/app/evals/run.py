"""Evaluation: LLM-as-judge over the demo workspace (ported from ai-rag-project).

Runs each question through the real RAG pipeline, then a second LLM call
grades the answer against the expected one. Results land in eval_runs and the
latest score is shown on the Insights page and as a README badge.

Runs against the DEMO workspace on purpose: synthetic data, so the eval is
reproducible by anyone who clones the repo.
"""
import json
import pathlib

from app.agents.llm import Usage, complete
from app.db import get_conn
from app.rag.chat import answer_text

JUDGE_PROMPT = """You are grading a question-answering system.
Compare the SYSTEM ANSWER to the EXPECTED ANSWER for the given QUESTION.

Reply with a JSON object only, like: {"score": 1, "reason": "..."}
score = 1 if the system answer is correct and consistent with the expected answer.
score = 0 if it is wrong, contradicts it, or hallucinates information.
"""


def judge(question: str, expected: str, got: str, usage: Usage) -> dict:
    resp = complete(
        [
            {"role": "system", "content": JUDGE_PROMPT},
            {"role": "user", "content": f"QUESTION: {question}\n\nEXPECTED ANSWER: {expected}\n\nSYSTEM ANSWER: {got}"},
        ],
        usage,
        response_format={"type": "json_object"},
    )
    return json.loads(resp.choices[0].message.content)


def run_evals() -> dict:
    cases = json.loads((pathlib.Path(__file__).parent / "questions.json").read_text())
    usage = Usage()

    results, passed = [], 0
    for c in cases:
        got, _sources = answer_text(c["question"], "demo")
        verdict = judge(c["question"], c["expected"], got, usage)
        ok = verdict.get("score", 0) == 1
        passed += int(ok)
        results.append({"question": c["question"], "expected": c["expected"],
                        "got": got, "pass": ok, "reason": verdict.get("reason", "")})

    with get_conn() as conn:
        conn.execute(
            "insert into eval_runs (score, total, cases) values (%s, %s, %s)",
            (passed, len(cases), json.dumps(results)),
        )
    return {"score": passed, "total": len(cases), "cases": results}
