"""Request dependencies — who is calling us?

Workspace resolution, in order:
1. A valid Supabase JWT (the owner logged in on the frontend) -> 'owner'.
   Supabase signs its tokens with HS256 using the project's JWT secret;
   verifying the signature proves the token really came from our Supabase.
   This is a single-user app, so any valid token = the owner.
2. Dev-only X-Workspace header -> 'owner' (ignored in production).
3. Everyone else -> 'demo' (the sandboxed recruiter playground).
"""
import jwt
from fastapi import Depends, Header, HTTPException

from app.config import settings


def get_workspace(authorization: str | None = Header(default=None),
                  x_workspace: str | None = Header(default=None)) -> str:
    if authorization and authorization.startswith("Bearer "):
        try:
            jwt.decode(
                authorization[7:],
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
            return "owner"
        except jwt.InvalidTokenError:
            # A token was presented but it's fake/expired: reject loudly,
            # don't silently downgrade to demo (that would hide bugs).
            raise HTTPException(401, "Invalid or expired token")

    if settings.env == "dev" and x_workspace == "owner":
        return "owner"
    return "demo"


def require_owner(workspace: str = Depends(get_workspace)) -> str:
    """Guard for admin endpoints (run evals, reset demo)."""
    if workspace != "owner":
        raise HTTPException(403, "Owner only")
    return workspace
