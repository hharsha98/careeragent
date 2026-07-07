"""CHAT: question -> retrieve chunks (pgvector) -> stream the answer with citations.

Ported from ai-rag-project's rag/chat.py. Two changes:
  1. Retrieval is a SQL query (`<=>` is pgvector's cosine-distance operator)
     instead of a ChromaDB call.
  2. answer() is now a *generator* that yields Server-Sent Events, so the
     frontend can render tokens as they arrive instead of waiting.
"""
import time

from openai import OpenAI

from app.config import settings
from app.db import get_conn
from app.usage import log_usage, sse

SYSTEM_PROMPT = """You are a helpful assistant that answers questions about the user's documents.

Rules:
- Answer ONLY using the numbered context passages provided.
- If the answer is not in the context, say "I couldn't find that in the documents." Do not guess.
- After each fact, cite the passage number it came from, like [1] or [2].
- Be concise and clear.
"""


def _client() -> OpenAI:
    return OpenAI(api_key=settings.mistral_api_key, base_url=settings.mistral_base_url)


def _hyde(client: OpenAI, question: str) -> str:
    """HyDE: a short hypothetical answer whose embedding often matches real
    passages better than the terse question. Used only as an extra search probe."""
    try:
        r = client.chat.completions.create(
            model=settings.chat_model, temperature=0, max_tokens=120,
            messages=[{"role": "system", "content": "Write a short 2-sentence passage that would "
                       "answer the question. It's used only as a search probe."},
                      {"role": "user", "content": question}])
        return (r.choices[0].message.content or question).strip()
    except Exception:
        return question


def _vec_ranks(conn, probe_vec, workspace, kind, limit):
    cur = conn.execute(
        """select c.id::text from chunks c join documents d on c.document_id = d.id
           where d.workspace = %s and (%s::text is null or d.kind = %s)
           order by c.embedding <=> %s::vector limit %s""",
        (workspace, kind, kind, probe_vec, limit))
    return {row[0]: rank for rank, row in enumerate(cur.fetchall())}


def retrieve(client: OpenAI, question: str, workspace: str, top_k: int,
             kind: str | None = None):
    """ADVANCED retrieval: hybrid (question-vector + HyDE-vector + BM25, fused with
    Reciprocal Rank Fusion) narrows to ~20 candidates, then a cross-encoder reranker
    picks the final top_k. kind='cv'/'jd' scopes to one document type."""
    from rank_bm25 import BM25Okapi
    from app.rag.rerank import rerank

    with get_conn() as conn:
        cur = conn.execute(
            """select c.id::text, c.content, c.source, c.page
               from chunks c join documents d on c.document_id = d.id
               where d.workspace = %s and (%s::text is null or d.kind = %s)""",
            (workspace, kind, kind))
        rows = cur.fetchall()
        n = len(rows)
        if n == 0:
            return []
        chunks = [{"id": r[0], "text": r[1], "source": r[2], "page": r[3]} for r in rows]

        q_vec, h_vec = client.embeddings.create(
            model=settings.embed_model, input=[question, _hyde(client, question)]).data
        lim = min(20, n)
        vector_rank = _vec_ranks(conn, q_vec.embedding, workspace, kind, lim)
        hyde_rank = _vec_ranks(conn, h_vec.embedding, workspace, kind, lim)

    bm25 = BM25Okapi([c["text"].lower().split() for c in chunks])
    scores = bm25.get_scores(question.lower().split())
    keyword_rank = {chunks[i]["id"]: rank for rank, i in
                    enumerate(sorted(range(n), key=lambda i: -scores[i]))}

    def rrf(cid):
        return (1 / (60 + vector_rank.get(cid, n)) + 1 / (60 + hyde_rank.get(cid, n))
                + 1 / (60 + keyword_rank.get(cid, n)))

    by_id = {c["id"]: c for c in chunks}
    candidates = [by_id[cid] for cid in sorted(by_id, key=rrf, reverse=True)[:20]]
    return rerank(question, candidates, top_k)


def build_context(chunks):
    """Number each chunk so the model can cite it as [1], [2], ... (unchanged)."""
    lines = []
    for i, c in enumerate(chunks, start=1):
        lines.append(f"[{i}] (from {c['source']}, page {c['page']})\n{c['text']}")
    return "\n\n".join(lines)


def answer_text(question: str, workspace: str):
    """Non-streaming answer for the eval suite: returns (text, chunks)."""
    client = _client()
    chunks = retrieve(client, question, workspace, settings.top_k)
    if not chunks:
        return "No documents found.", []
    resp = client.chat.completions.create(
        model=settings.chat_model,
        temperature=0,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Context:\n{build_context(chunks)}\n\nQuestion: {question}"},
        ],
    )
    return resp.choices[0].message.content, chunks


def answer_stream(question: str, workspace: str):
    """Yield SSE frames: token* -> sources -> usage. Consumed by StreamingResponse."""
    t0 = time.monotonic()
    client = _client()

    chunks = retrieve(client, question, workspace, settings.top_k)
    if not chunks:
        yield sse("token", {"text": "No documents found — upload a CV or job description first."})
        yield sse("sources", [])
        return

    stream = client.chat.completions.create(
        model=settings.chat_model,
        temperature=0,  # factual & repeatable — important for RAG
        stream=True,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Context:\n{build_context(chunks)}\n\nQuestion: {question}"},
        ],
    )

    full_text = []
    usage = None
    for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            full_text.append(chunk.choices[0].delta.content)
            yield sse("token", {"text": chunk.choices[0].delta.content})
        if getattr(chunk, "usage", None):  # Mistral sends usage in the final chunk
            usage = chunk.usage

    yield sse("sources", [{"n": i, "source": c["source"], "page": c["page"]}
                          for i, c in enumerate(chunks, start=1)])

    # Fall back to a rough estimate (~4 chars/token) if usage wasn't streamed
    tokens_in = usage.prompt_tokens if usage else len(build_context(chunks)) // 4
    tokens_out = usage.completion_tokens if usage else len("".join(full_text)) // 4
    record = log_usage(workspace, "/api/chat", settings.chat_model,
                       tokens_in, tokens_out, int((time.monotonic() - t0) * 1000))
    yield sse("usage", record)
