"""Request dependencies — who is calling us?

Every table row belongs to a workspace: 'demo' (anonymous visitors) or 'owner'
(you). Until owner login lands on Day 6, everyone is 'demo' — EXCEPT in local
development, where the X-Workspace header lets us ingest your real CV as owner.
That header is ignored in production on purpose.
"""
from fastapi import Header

from app.config import settings


def get_workspace(x_workspace: str | None = Header(default=None)) -> str:
    if settings.env == "dev" and x_workspace == "owner":
        return "owner"
    # Day 6: a valid Supabase JWT will also map to "owner" here.
    return "demo"
