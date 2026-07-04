"""INGEST: PDF bytes -> text -> chunks -> embeddings -> Postgres (pgvector).

Ported from ai-rag-project's rag/ingest.py. Two changes:
  1. Reads PDFs from uploaded bytes instead of a folder on disk.
  2. Stores chunks in the `chunks` table instead of ChromaDB — so the data
     survives redeploys of the (stateless) backend container.
"""
import io
import time

from openai import OpenAI
from pypdf import PdfReader

from app.config import settings
from app.db import get_conn
from app.usage import log_usage


def read_pdf(data: bytes):
    """Pull the plain text out of a PDF, page by page."""
    reader = PdfReader(io.BytesIO(data))
    pages = []
    for page_number, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        if text.strip():
            pages.append((page_number, text))
    return pages


def chunk_text(text: str, size: int, overlap: int):
    """Split a long string into overlapping windows (ported verbatim).
    Overlap stops us cutting a sentence in half between two chunks."""
    chunks = []
    start = 0
    while start < len(text):
        end = start + size
        chunks.append(text[start:end])
        start += size - overlap
    return chunks


def embed_batch(client: OpenAI, texts: list[str]):
    """One API call: list of chunks -> list of 1024-dim vectors."""
    resp = client.embeddings.create(model=settings.embed_model, input=texts)
    return [item.embedding for item in resp.data], resp.usage


def _embed_and_store(document_id: str, rows: list[tuple], workspace: str) -> int:
    """Shared tail of every ingest: embed rows of (content, source, page), store."""
    client = OpenAI(api_key=settings.mistral_api_key, base_url=settings.mistral_base_url)

    BATCH = 64
    t0 = time.monotonic()
    total_tokens = 0
    with get_conn() as conn:
        for start in range(0, len(rows), BATCH):
            batch = rows[start:start + BATCH]
            embeddings, usage = embed_batch(client, [r[0] for r in batch])
            total_tokens += usage.total_tokens
            for (content, source, page), embedding in zip(batch, embeddings):
                conn.execute(
                    """insert into chunks (document_id, content, source, page, embedding)
                       values (%s, %s, %s, %s, %s)""",
                    (document_id, content, source, page, embedding),
                )
            if start + BATCH < len(rows):
                time.sleep(1.5)  # Mistral free tier: ~1 request/second

    log_usage(workspace, "/api/documents", settings.embed_model,
              total_tokens, 0, int((time.monotonic() - t0) * 1000))
    return len(rows)


def ingest_pdf(document_id: str, filename: str, data: bytes, workspace: str) -> int:
    """Chunk + embed one uploaded PDF and store everything. Returns chunk count."""
    rows = []  # (content, source, page)
    for page_number, page_text in read_pdf(data):
        for chunk in chunk_text(page_text, settings.chunk_size, settings.chunk_overlap):
            rows.append((chunk, filename, page_number))
    return _embed_and_store(document_id, rows, workspace)


def ingest_text(document_id: str, filename: str, text: str, workspace: str) -> int:
    """Same pipeline for plain text (used to seed the synthetic demo CV)."""
    rows = [(chunk, filename, 1)
            for chunk in chunk_text(text, settings.chunk_size, settings.chunk_overlap)]
    return _embed_and_store(document_id, rows, workspace)
