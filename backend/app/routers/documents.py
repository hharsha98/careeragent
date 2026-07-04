"""Document endpoints: upload (validates + ingests), list, delete."""
from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile

from app.db import get_conn
from app.deps import get_workspace
from app.rag.ingest import ingest_pdf, read_pdf

router = APIRouter(prefix="/api/documents", tags=["documents"])

MAX_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_PAGES = 20


@router.get("")
def list_documents(workspace: str = Depends(get_workspace)):
    with get_conn() as conn:
        cur = conn.execute(
            """select d.id::text, d.filename, d.kind, d.created_at,
                      count(c.id) as chunk_count
               from documents d left join chunks c on c.document_id = d.id
               where d.workspace = %s
               group by d.id order by d.created_at desc""",
            (workspace,),
        )
        cols = [c.name for c in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


@router.post("", status_code=201)
async def upload_document(file: UploadFile, kind: str = Form(...),
                          workspace: str = Depends(get_workspace)):
    if kind not in ("cv", "jd"):
        raise HTTPException(422, "kind must be 'cv' or 'jd'")

    data = await file.read()
    # Magic bytes: every real PDF starts with %PDF — don't trust the file extension
    if not data.startswith(b"%PDF"):
        raise HTTPException(422, "Only PDF files are accepted")
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "PDF too large (max 5 MB)")
    if len(read_pdf(data)) > MAX_PAGES:
        raise HTTPException(413, f"Too many pages (max {MAX_PAGES})")

    with get_conn() as conn:
        cur = conn.execute(
            "insert into documents (workspace, filename, kind) values (%s, %s, %s) returning id::text",
            (workspace, file.filename, kind),
        )
        document_id = cur.fetchone()[0]

    chunk_count = ingest_pdf(document_id, file.filename, data, workspace)
    return {"id": document_id, "filename": file.filename, "kind": kind,
            "chunks": chunk_count}


@router.delete("/{document_id}", status_code=204)
def delete_document(document_id: str, workspace: str = Depends(get_workspace)):
    with get_conn() as conn:
        cur = conn.execute(
            "delete from documents where id = %s and workspace = %s returning id",
            (document_id, workspace),  # chunks cascade-delete with the document
        )
        if cur.fetchone() is None:
            raise HTTPException(404, "Document not found")
