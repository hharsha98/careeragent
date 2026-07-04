"""Chat endpoint — streams the RAG answer as Server-Sent Events."""
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.deps import get_workspace
from app.limits import CHAT_LIMIT, limiter
from app.rag.chat import answer_stream

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)


@router.post("")
@limiter.limit(CHAT_LIMIT)  # slowapi needs the `request` param below to see the IP
def chat(request: Request, req: ChatRequest, workspace: str = Depends(get_workspace)):
    return StreamingResponse(
        answer_stream(req.question, workspace),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"},  # proxies must not buffer the stream
    )
