"""Tools the agents can call. One for now: web search.

Tavily is the primary (an API built for LLM agents — clean text, no HTML).
If Tavily is down or out of credits, ddgs (DuckDuckGo) answers instead —
scrappier results, but zero keys and zero cost.
"""
from app.config import settings

WEB_SEARCH_SPEC = {
    "type": "function",
    "function": {
        "name": "web_search",
        "description": "Search the web. Returns a list of results with title, url, and content.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "The search query"},
            },
            "required": ["query"],
        },
    },
}


def web_search(query: str, max_results: int = 5) -> list[dict]:
    try:
        from tavily import TavilyClient
        resp = TavilyClient(api_key=settings.tavily_api_key).search(
            query, max_results=max_results)
        results = [{"title": r["title"], "url": r["url"], "content": r["content"][:600]}
                   for r in resp.get("results", [])]
        if results:
            return results
    except Exception:
        pass  # fall through to DuckDuckGo

    try:
        from ddgs import DDGS
        return [{"title": r["title"], "url": r["href"], "content": r["body"][:600]}
                for r in DDGS().text(query, max_results=max_results)]
    except Exception:
        return [{"title": "search unavailable", "url": "", "content": "Both search providers failed."}]
