"""Demo workspace: what anonymous visitors (recruiters!) get to play with.

Seeded with a SYNTHETIC candidate — "Alex Muster" — so the demo never leaks
the owner's real CV. Seeding runs at startup when the demo workspace is
empty; the owner can also force a reset via the admin endpoint.
"""
import json

from app.db import get_conn
from app.rag.ingest import ingest_text

DEMO_CV = """Alex Muster — AI Engineer, Berlin. alex.muster@example.com

EXPERIENCE
ML Engineer, RoboLogistics GmbH (2024-2026): Built a RAG pipeline over 12,000
maintenance manuals using pgvector and Mistral embeddings; reduced technician
search time by 40%. Deployed FastAPI microservices on Kubernetes (EKS), added
evaluation suites with LLM-as-judge scoring reaching 92% faithfulness.
Data Analyst, MobilityData AG (2022-2024): Python ETL pipelines (Airflow,
PostgreSQL) processing 3M daily vehicle events; built Grafana dashboards.

EDUCATION
M.Sc. Data Science, TU Berlin (2020-2022). Thesis: evaluating hallucination
rates in retrieval-augmented question answering.
B.Sc. Computer Science, RWTH Aachen (2016-2020).

SKILLS
Python, FastAPI, PostgreSQL, pgvector, Docker, Kubernetes, RAG, embeddings,
prompt engineering, evaluation (Ragas), React, TypeScript. German C2, English C1.
"""

DEMO_APPLICATIONS = [
    ("Aleph Alpha", "AI Engineer", "interested"),
    ("DeepL", "ML Engineer — LLM Products", "applied"),
    ("Celonis", "AI Solutions Engineer", "interview"),
]

# One pre-baked artifact so the demo drawer isn't empty before anyone runs an agent.
PREBAKED_RESEARCH = {
    "company": "DeepL",
    "summary": "DeepL builds AI translation and writing tools used by over 100,000 "
               "businesses. Known for translation quality that often beats larger rivals; "
               "expanding into voice and agentic language products.",
    "products": ["DeepL Translator", "DeepL Write", "DeepL API", "DeepL Voice"],
    "recent_news": ["Expanding LLM research teams in Cologne and London"],
    "tech_stack": ["Python", "Kubernetes", "own LLM training infrastructure"],
    "talking_points": ["Experience with evaluation suites matches DeepL's quality-first culture",
                        "RAG + pgvector work maps to their retrieval products"],
    "sources": ["https://www.deepl.com/en/press", "https://jobs.deepl.com"],
}


def demo_is_empty() -> bool:
    with get_conn() as conn:
        cur = conn.execute("select count(*) from documents where workspace = 'demo'")
        return cur.fetchone()[0] == 0


def reset_demo():
    """Wipe and reseed the demo workspace. Called at startup (if empty) and
    by the owner-only admin endpoint / daily GitHub Action."""
    with get_conn() as conn:
        conn.execute("delete from documents where workspace = 'demo'")     # chunks cascade
        conn.execute("delete from applications where workspace = 'demo'")  # artifacts cascade

    with get_conn() as conn:
        cur = conn.execute(
            "insert into documents (workspace, filename, kind) values ('demo', 'alex-muster-cv.pdf', 'cv') returning id::text")
        doc_id = cur.fetchone()[0]
    ingest_text(doc_id, "alex-muster-cv.pdf", DEMO_CV, "demo")

    with get_conn() as conn:
        for position, (company, role, status) in enumerate(DEMO_APPLICATIONS):
            cur = conn.execute(
                """insert into applications (workspace, company, role, status, position)
                   values ('demo', %s, %s, %s, %s) returning id::text""",
                (company, role, status, position),
            )
            app_id = cur.fetchone()[0]
            if company == "DeepL":
                conn.execute(
                    """insert into artifacts (application_id, type, content, model)
                       values (%s, 'research', %s, 'prebaked')""",
                    (app_id, json.dumps(PREBAKED_RESEARCH)),
                )
