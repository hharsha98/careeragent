"""Insights endpoints: usage/cost aggregates, eval results, admin actions.

This page is the portfolio differentiator — most demo projects can't show
per-request cost accounting or a live evaluation score.
"""
from fastapi import APIRouter, Depends

from app.db import get_conn
from app.demo import reset_demo
from app.deps import get_workspace, require_owner
from app.evals.run import run_evals

router = APIRouter(prefix="/api/insights", tags=["insights"])


@router.get("/usage")
def usage_summary(workspace: str = Depends(get_workspace)):
    with get_conn() as conn:
        cur = conn.execute(
            """select coalesce(sum(tokens_in),0), coalesce(sum(tokens_out),0),
                      coalesce(sum(cost_usd),0), count(*)
               from usage_log where workspace = %s""", (workspace,))
        tin, tout, cost, requests = cur.fetchone()

        cur = conn.execute(
            """select endpoint, model, count(*), sum(tokens_in), sum(tokens_out),
                      sum(cost_usd), avg(latency_ms)::int
               from usage_log where workspace = %s
               group by endpoint, model order by sum(cost_usd) desc""", (workspace,))
        breakdown = [dict(zip(
            ["endpoint", "model", "requests", "tokens_in", "tokens_out", "cost_usd", "avg_latency_ms"],
            row)) for row in cur.fetchall()]

    return {"totals": {"tokens_in": tin, "tokens_out": tout,
                       "cost_usd": float(cost), "requests": requests},
            "breakdown": breakdown}


@router.get("/evals")
def latest_eval():
    with get_conn() as conn:
        cur = conn.execute(
            "select score, total, cases, created_at from eval_runs order by created_at desc limit 1")
        row = cur.fetchone()
    if row is None:
        return {"score": None, "total": None, "cases": [], "created_at": None}
    return {"score": row[0], "total": row[1], "cases": row[2], "created_at": str(row[3])}


@router.post("/evals/run", dependencies=[Depends(require_owner)])
def trigger_eval():
    """Owner-only: run the full eval suite (several LLM calls)."""
    return run_evals()


@router.post("/reset-demo", dependencies=[Depends(require_owner)])
def trigger_demo_reset():
    """Owner-only: wipe and reseed the demo workspace."""
    reset_demo()
    return {"ok": True}
