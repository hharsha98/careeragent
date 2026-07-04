"""Application tracker CRUD — the data behind the Kanban board."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.db import get_conn
from app.deps import get_workspace

router = APIRouter(prefix="/api/applications", tags=["applications"])

STATUSES = ("interested", "applied", "interview", "offer", "rejected")


class ApplicationCreate(BaseModel):
    company: str = Field(min_length=1, max_length=200)
    role: str = Field(min_length=1, max_length=200)
    jd_document_id: str | None = None


class ApplicationUpdate(BaseModel):
    status: str | None = None
    position: int | None = None
    company: str | None = None
    role: str | None = None
    jd_document_id: str | None = None


@router.get("")
def list_applications(workspace: str = Depends(get_workspace)):
    """Board data: every card + how many artifacts it carries."""
    with get_conn() as conn:
        cur = conn.execute(
            """select a.id::text, a.company, a.role, a.status, a.position,
                      a.jd_document_id::text, a.created_at,
                      count(t.id) as artifact_count
               from applications a left join artifacts t on t.application_id = a.id
               where a.workspace = %s
               group by a.id
               order by a.status, a.position, a.created_at""",
            (workspace,),
        )
        cols = [c.name for c in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


@router.post("", status_code=201)
def create_application(body: ApplicationCreate, workspace: str = Depends(get_workspace)):
    with get_conn() as conn:
        cur = conn.execute(
            """insert into applications (workspace, company, role, jd_document_id)
               values (%s, %s, %s, %s) returning id::text""",
            (workspace, body.company, body.role, body.jd_document_id),
        )
        return {"id": cur.fetchone()[0]}


@router.patch("/{application_id}")
def update_application(application_id: str, body: ApplicationUpdate,
                       workspace: str = Depends(get_workspace)):
    """Drag-and-drop lands here: PATCH {status, position}."""
    if body.status is not None and body.status not in STATUSES:
        raise HTTPException(422, f"status must be one of {STATUSES}")

    fields, values = [], []
    for name in ("status", "position", "company", "role", "jd_document_id"):
        value = getattr(body, name)
        if value is not None:
            fields.append(f"{name} = %s")
            values.append(value)
    if not fields:
        raise HTTPException(422, "Nothing to update")

    with get_conn() as conn:
        cur = conn.execute(
            f"update applications set {', '.join(fields)} where id = %s and workspace = %s returning id",
            (*values, application_id, workspace),
        )
        if cur.fetchone() is None:
            raise HTTPException(404, "Application not found")
    return {"ok": True}


@router.delete("/{application_id}", status_code=204)
def delete_application(application_id: str, workspace: str = Depends(get_workspace)):
    with get_conn() as conn:
        cur = conn.execute(
            "delete from applications where id = %s and workspace = %s returning id",
            (application_id, workspace),  # artifacts cascade-delete
        )
        if cur.fetchone() is None:
            raise HTTPException(404, "Application not found")


@router.get("/{application_id}/artifacts")
def list_artifacts(application_id: str, workspace: str = Depends(get_workspace)):
    with get_conn() as conn:
        cur = conn.execute(
            """select t.id::text, t.type, t.content, t.model, t.tokens_in,
                      t.tokens_out, t.cost_usd, t.created_at
               from artifacts t join applications a on a.id = t.application_id
               where t.application_id = %s and a.workspace = %s
               order by t.created_at desc""",
            (application_id, workspace),
        )
        cols = [c.name for c in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]
