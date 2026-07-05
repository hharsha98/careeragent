# CareerAgent — AI agents for the job hunt

**Eval: 6/6** · **€0/month infrastructure** · **no agent framework, on purpose**

A deployed multi-agent platform: chat with a CV and get **cited** answers,
research companies **live on the web**, tailor CV bullets to any job
description **anchored to real evidence**, and track applications on a Kanban
board — with per-request **cost metering** and an **LLM-as-judge evaluation
suite** built in.

> 🔗 **Live demo:** _coming online — frontend on Cloudflare Pages, API on Hugging Face Spaces_
> 🧪 Try it without signing up: the demo workspace uses a synthetic candidate and resets regularly.

## Architecture

```
React + Vite ──► FastAPI ──► Postgres + pgvector ──► Mistral / Groq / Tavily
Cloudflare Pages   Docker        Supabase              free tiers,
                HF Spaces / k8s                        keys server-side only
```

- **RAG chat** — pgvector cosine retrieval, answers stream over SSE with `[n]` citations; refuses to answer what isn't in the documents
- **Research agent** — a hand-rolled tool loop (a `while` loop around function calling) drives Tavily web search, then structured output (JSON mode + Pydantic validation + one self-correction retry) shapes the brief
- **Tailor agent** — retrieves CV evidence for a job description; every bullet carries the CV quote that supports it, plus *honest gaps*
- **Provider fallback** — Groq first, Mistral on failure. It has already fired in real use.
- **Cost metering** — every LLM request logs tokens, latency, and list-price cost; charted on the Insights page
- **Evals** — LLM-as-judge suite incl. trick questions where "I don't know" is the right answer. Current score: **6/6**.

### Why no agent framework?

The three patterns that make an "agent" — tool loop, structured output,
provider fallback — are ~100 lines of plain Python in
[`backend/app/agents/llm.py`](backend/app/agents/llm.py). I can explain every
line, which is the point of a portfolio project. LangGraph/CrewAI are noted as
future work for multi-step orchestration.

## Security by design

- `/docs`, `/redoc`, `/openapi.json` **disabled in production** (many portfolio APIs leave them public)
- CORS pinned to exactly one origin
- Per-IP rate limits on every LLM endpoint (slowapi)
- Uploads validated by magic bytes, size, and page count
- Owner actions verified server-side via Supabase JWT; visitors get a sandboxed demo workspace with synthetic data
- Web content and job descriptions treated as untrusted data in prompts

## Run it locally

```bash
# backend
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # fill in your keys (all free tiers)
uvicorn app.main:app --reload --port 7860

# frontend (second terminal)
cd frontend
npm install && npm run dev   # http://localhost:5173
```

## Kubernetes (the same container, orchestrated)

The production demo runs on Hugging Face Spaces (serverless container hosting —
free and always warm). The **same image** also deploys to Kubernetes; `k8s/`
holds real manifests with replicas, liveness/readiness probes, resource limits,
and an autoscaler. Reproduce locally with [kind](https://kind.sigs.k8s.io/):

```bash
cd backend && docker build -t careeragent-backend:local .
kind create cluster --name careeragent
kind load docker-image careeragent-backend:local --name careeragent
kubectl create secret generic careeragent-secrets --from-env-file=backend/.env
kubectl apply -f k8s/
kubectl get pods
#   careeragent-backend-67b9d4cf79-cqscr   1/1   Running
#   careeragent-backend-67b9d4cf79-l5l2z   1/1   Running

# self-healing: kill a pod, watch the Deployment replace it in seconds
kubectl delete pod <one-of-the-pods>
kubectl get pods   # a fresh pod is already starting

# serve it: kubectl port-forward service/careeragent-backend 8080:80
```

Why serverless for the public demo instead of a cloud cluster? **Cost.** A
managed Kubernetes cluster is never free; a portfolio demo doesn't need one.
Knowing when *not* to use Kubernetes is part of knowing Kubernetes.

## Evaluation

`backend/app/evals/` runs each question through the real RAG pipeline and has
a second model judge the answer against the expected one (LLM-as-judge). The
suite includes a hallucination trap — a question the documents cannot answer —
where only a refusal counts as a pass. Results persist to the database and are
shown live on the Insights page. Next step: Ragas/DeepEval for faithfulness and
context-precision metrics.

## CI/CD

- `deploy-backend.yml` — pushes `backend/` to the HF Space on every merge to main
- `keepalive.yml` — twice-weekly ping so the free-tier database never pauses

## Roadmap (deliberately out of MVP scope)

Hybrid search + reranking · Ragas eval metrics · code-splitting the frontend
bundle · marketplace/multi-user workspaces · workflow orchestration (LangGraph)

---

Built by **Harsha** ([@hharsha98](https://github.com/hharsha98)) — M.Sc. Electromobility, FAU Erlangen-Nürnberg.
First project in this series: [ai-rag-project](https://github.com/hharsha98/ai-rag-project).
