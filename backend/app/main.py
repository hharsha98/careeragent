"""CareerAgent backend — FastAPI application entry point.

Security note (deliberate, see README): interactive API docs are DISABLED in
production. Exposing /docs publicly leaks your whole API surface to attackers.
"""
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.limits import limiter
from app.routers import agents, applications, chat, documents, insights

STARTED_AT = time.monotonic()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Seed the recruiter demo on first boot (skipped if already populated).
    try:
        from app.demo import demo_is_empty, reset_demo
        if demo_is_empty():
            reset_demo()
            print("demo workspace seeded")
    except Exception as e:
        # A broken demo seed should never keep the whole API down.
        print(f"demo seed skipped: {e}")
    yield


# In prod: no /docs, no /redoc, no /openapi.json. In dev they stay on for us.
_docs_kwargs = (
    {"docs_url": None, "redoc_url": None, "openapi_url": None}
    if settings.env == "prod"
    else {}
)

app = FastAPI(title="CareerAgent API", version="0.1.0", lifespan=lifespan, **_docs_kwargs)

# Per-IP rate limiting (slowapi): returns 429 with a friendly message.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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
app.include_router(applications.router)
app.include_router(insights.router)


@app.get("/api/health")
def health():
    """Liveness check — also the target for the weekly keep-alive ping."""
    return {
        "status": "ok",
        "version": app.version,
        "env": settings.env,
        "uptime_seconds": round(time.monotonic() - STARTED_AT, 1),
    }
