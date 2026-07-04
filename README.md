# CareerAgent — AI agents for the job hunt

A deployed multi-agent platform that chats over your CV with citations, researches
companies live on the web, tailors your CV to any job description, and tracks
applications on a Kanban board — with token-cost tracking and an evaluation suite.

> **Status: Day 1 of a 14-day build.** This README grows with the project.

## Architecture (planned)

- **Frontend:** React + Vite + Tailwind → Cloudflare Pages
- **Backend:** Python FastAPI in Docker → Hugging Face Spaces (also deployable to Kubernetes — see `k8s/`)
- **Database:** Supabase Postgres + pgvector (embeddings live in the same database as everything else)
- **LLMs:** Mistral (embeddings + RAG chat), Groq Llama 3.3 70B (agents), all free tiers, all keys server-side
- **No agent framework, on purpose:** the tool loop, structured output, and provider
  fallback are ~100 lines of plain Python — I can explain every one of them.

## Security by design

- API docs (`/docs`, `/openapi.json`) are **disabled in production**
- CORS locked to the frontend origin
- Per-IP rate limits on every LLM endpoint
- Visitors get a sandboxed demo workspace — no signup, no access to real data

## Run locally

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your keys
uvicorn app.main:app --reload --port 7860
# → http://localhost:7860/api/health
```
