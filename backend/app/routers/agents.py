"""Agent endpoints. Both persist their result as an artifact attached to an
application card — the Kanban drawer renders these on Day 10-11.
"""
import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.agents.research import run_research
from app.agents.tailor import run_tailor
from app.db import get_conn
from app.deps import get_workspace

router = APIRouter(prefix="/api/agents", tags=["agents"])


class AgentRequest(BaseModel):
    application_id: str
    jd_text: str | None = None  # tailor: pass JD text directly, or rely on the linked JD document


def _load_application(application_id: str, workspace: str):
    with get_conn() as conn:
        cur = conn.execute(
            "select company, role, jd_document_id::text from applications where id = %s and workspace = %s",
            (application_id, workspace),
        )
        row = cur.fetchone()
    if row is None:
        raise HTTPException(404, "Application not found")
    return {"company": row[0], "role": row[1], "jd_document_id": row[2]}


def _save_artifact(application_id: str, kind: str, content: dict, record: dict) -> dict:
    with get_conn() as conn:
        cur = conn.execute(
            """insert into artifacts (application_id, type, content, model, tokens_in, tokens_out, cost_usd)
               values (%s, %s, %s, %s, %s, %s, %s) returning id::text, created_at""",
            (application_id, kind, json.dumps(content), record["model"],
             record["tokens_in"], record["tokens_out"], record["cost_usd"]),
        )
        artifact_id, created_at = cur.fetchone()
    return {"id": artifact_id, "type": kind, "content": content,
            "usage": record, "created_at": str(created_at)}


@router.post("/research")
def research(req: AgentRequest, workspace: str = Depends(get_workspace)):
    app_row = _load_application(req.application_id, workspace)
    brief, record = run_research(app_row["company"], app_row["role"], workspace)
    return _save_artifact(req.application_id, "research", brief.model_dump(), record)


@router.post("/tailor")
def tailor(req: AgentRequest, workspace: str = Depends(get_workspace)):
    _load_application(req.application_id, workspace)  # 404 if missing

    jd_text = req.jd_text
    if not jd_text:
        app_row = _load_application(req.application_id, workspace)
        if not app_row["jd_document_id"]:
            raise HTTPException(422, "Provide jd_text or link a JD document to this application")
        with get_conn() as conn:
            cur = conn.execute(
                "select string_agg(content, ' ' order by page) from chunks where document_id = %s",
                (app_row["jd_document_id"],),
            )
            jd_text = cur.fetchone()[0] or ""

    try:
        tailored, record = run_tailor(jd_text, workspace)
    except ValueError as e:
        raise HTTPException(422, str(e))
    return _save_artifact(req.application_id, "tailoring", tailored.model_dump(), record)
