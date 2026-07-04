"""Token/cost accounting — the Insights page reads what we record here.

The free tiers cost us nothing, but we record the LIST-PRICE equivalent anyway:
"what would this request cost at published prices" is exactly what employers
care about, and it makes the demo numbers real.
"""
import json

from app.db import get_conn

# USD per 1M tokens: (input, output). Published list prices, 2026-07.
PRICES_PER_M = {
    "mistral-embed": (0.10, 0.0),
    "mistral-small-latest": (0.10, 0.30),
    "llama-3.3-70b-versatile": (0.59, 0.79),  # Groq
}


def cost_usd(model: str, tokens_in: int, tokens_out: int) -> float:
    p_in, p_out = PRICES_PER_M.get(model, (0.0, 0.0))
    return (tokens_in * p_in + tokens_out * p_out) / 1_000_000


def log_usage(workspace: str, endpoint: str, model: str,
              tokens_in: int, tokens_out: int, latency_ms: int) -> dict:
    """Insert one usage row; returns the record (the SSE 'usage' event body)."""
    record = {
        "model": model,
        "tokens_in": tokens_in,
        "tokens_out": tokens_out,
        "cost_usd": round(cost_usd(model, tokens_in, tokens_out), 6),
        "latency_ms": latency_ms,
    }
    with get_conn() as conn:
        conn.execute(
            """insert into usage_log
               (workspace, endpoint, model, tokens_in, tokens_out, cost_usd, latency_ms)
               values (%s, %s, %s, %s, %s, %s, %s)""",
            (workspace, endpoint, model, tokens_in, tokens_out,
             record["cost_usd"], latency_ms),
        )
    return record


def sse(event: str, data) -> str:
    """Format one Server-Sent Event frame: 'event: X\\ndata: JSON\\n\\n'."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"
