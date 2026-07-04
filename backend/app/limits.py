"""Per-IP rate limiting (slowapi). Lives in its own module so routers and
main.py can both import it without circular imports.

Why per-IP: the demo has no accounts, so the visitor's IP is the only
identity we have. Limits are sized so a curious recruiter never hits them
but a scraper burning our free LLM quota does.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

CHAT_LIMIT = "10/minute"
AGENT_LIMIT = "6/hour"
UPLOAD_LIMIT = "4/hour"
