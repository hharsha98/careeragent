"""CareerAgent backend — FastAPI application entry point.

Security note (deliberate, see README): interactive API docs are DISABLED in
production. Exposing /docs publicly leaks your whole API surface to attackers.
"""
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import agents, chat, documents

STARTED_AT = time.monotonic()

# In prod: no /docs, no /redoc, no /openapi.json. In dev they stay on for us.
_docs_kwargs = (
    {"docs_url": None, "redoc_url": None, "openapi_url": None}
    if settings.env == "prod"
    else {}
)

app = FastAPI(title="CareerAgent API", version="0.1.0", **_docs_kwargs)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],  # exactly one origin, never "*"
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(agents.router)


@app.get("/api/health")
def health():
    """Liveness check — also the target for the weekly keep-alive ping."""
    return {
        "status": "ok",
        "version": app.version,
        "env": settings.env,
        "uptime_seconds": round(time.monotonic() - STARTED_AT, 1),
    }
