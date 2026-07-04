-- CareerAgent database schema. Run ONCE in the Supabase SQL editor.
-- Every user-facing table carries workspace = 'demo' (visitors) or 'owner' (you).

create extension if not exists vector;

create table documents (
  id          uuid primary key default gen_random_uuid(),
  workspace   text not null default 'demo' check (workspace in ('demo','owner')),
  filename    text not null,
  kind        text not null check (kind in ('cv','jd')),
  created_at  timestamptz not null default now()
);

create table chunks (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  content      text not null,
  source       text not null,          -- filename, for citations
  page         int  not null,
  embedding    vector(1024)            -- mistral-embed dimension
);
-- HNSW = fast approximate nearest-neighbour index for cosine similarity search
create index chunks_embedding_idx on chunks using hnsw (embedding vector_cosine_ops);

create table applications (
  id              uuid primary key default gen_random_uuid(),
  workspace       text not null default 'demo' check (workspace in ('demo','owner')),
  company         text not null,
  role            text not null,
  jd_document_id  uuid references documents(id) on delete set null,
  status          text not null default 'interested'
                  check (status in ('interested','applied','interview','offer','rejected')),
  position        int not null default 0,   -- order within a Kanban column
  created_at      timestamptz not null default now()
);

create table artifacts (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references applications(id) on delete cascade,
  type            text not null check (type in ('research','tailoring')),
  content         jsonb not null,
  model           text not null,
  tokens_in       int not null default 0,
  tokens_out      int not null default 0,
  cost_usd        numeric(10,6) not null default 0,
  created_at      timestamptz not null default now()
);

create table usage_log (
  id          bigint generated always as identity primary key,
  workspace   text not null,
  endpoint    text not null,
  model       text not null,
  tokens_in   int not null default 0,
  tokens_out  int not null default 0,
  cost_usd    numeric(10,6) not null default 0,
  latency_ms  int not null default 0,
  created_at  timestamptz not null default now()
);

create table eval_runs (
  id          uuid primary key default gen_random_uuid(),
  score       int not null,
  total       int not null,
  cases       jsonb not null,   -- [{question, expected, got, pass, reason}]
  created_at  timestamptz not null default now()
);
