"""Cross-encoder reranking via FlashRank (ONNX ms-marco-MiniLM — no torch, CPU-fast).
Reads (query, passage) together for true relevance — sharper than vector similarity.
Ported from RetrievalLab; operates on CareerAgent's chunk dicts (key 'text')."""
from flashrank import Ranker, RerankRequest

_ranker = Ranker(model_name="ms-marco-MiniLM-L-12-v2")


def rerank(query: str, chunks: list[dict], top_k: int) -> list[dict]:
    if not chunks:
        return []
    passages = [{"id": i, "text": c["text"], "meta": c} for i, c in enumerate(chunks)]
    ranked = _ranker.rerank(RerankRequest(query=query, passages=passages))
    return [dict(r["meta"]) for r in ranked[:top_k]]
