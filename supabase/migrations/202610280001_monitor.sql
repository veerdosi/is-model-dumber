begin;
create table if not exists public.suites (
 id text primary key, title text not null, manifest_hash text not null, frozen_at timestamptz not null,
 frozen_until timestamptz not null, protocol jsonb not null, created_at timestamptz not null default now()
);
create table if not exists public.tasks (
 id text primary key, suite_id text not null references public.suites(id), title text not null,
 capability text not null, description text not null, prompt text not null, source_url text,
 source_revision text not null, license text not null, grader_version text not null,
 max_seconds integer not null check(max_seconds>0), definition_hash text not null,
 publishable boolean not null default true, metadata jsonb not null default '{}'
);
create table if not exists public.runs (
 id uuid primary key, idempotency_key text unique not null, suite_id text not null references public.suites(id),
 started_at timestamptz not null, completed_at timestamptz, status text not null check(status in ('running','complete','partial','failed')),
 published boolean not null default false, configuration jsonb not null, environment jsonb not null,
 check (status <> 'complete' or completed_at is not null)
);
create table if not exists public.attempts (
 id uuid primary key, run_id uuid not null references public.runs(id), task_id text not null references public.tasks(id),
 model text not null check(model in ('gpt-6.1-terra','gpt-6-luna','gpt-6.1-sol')),
 reasoning_effort text not null check(reasoning_effort='medium'), attempt_number integer not null default 1 check(attempt_number>0),
 runtime_model text, identity_evidence jsonb not null, configuration jsonb not null,
 started_at timestamptz not null, completed_at timestamptz not null, latency_ms integer check(latency_ms>=0),
 execution_status text not null check(execution_status in ('success','task_error','infrastructure_error','timeout')),
 score double precision check(score between 0 and 1), response text, response_hash text,
 actions jsonb not null default '[]', grading jsonb not null, error jsonb,
 input_tokens bigint, output_tokens bigint, cached_tokens bigint, cost_usd numeric,
 unique(run_id,task_id,model,attempt_number),
 check (execution_status not in ('infrastructure_error','timeout') or score is null),
 check (execution_status <> 'success' or runtime_model=model)
);
create index if not exists attempts_model_time on public.attempts(model,completed_at desc);
create index if not exists attempts_run on public.attempts(run_id);
create table if not exists public.incidents (
 id text primary key, model text not null, run_id uuid not null references public.runs(id),
 kind text not null check(kind in ('possible_regression','supported_change','recovery','behaviour_change','infrastructure')),
 title text not null, description text not null, evidence jsonb not null, created_at timestamptz not null default now()
);
alter table public.suites enable row level security;
alter table public.tasks enable row level security;
alter table public.runs enable row level security;
alter table public.attempts enable row level security;
alter table public.incidents enable row level security;
create policy suites_read on public.suites for select to anon,authenticated using(true);
create policy tasks_read on public.tasks for select to anon,authenticated using(publishable);
create policy runs_read on public.runs for select to anon,authenticated using(published);
create policy attempts_read on public.attempts for select to anon,authenticated using (
 exists(select 1 from public.runs where runs.id=attempts.run_id and published)
 and exists(select 1 from public.tasks where tasks.id=attempts.task_id and publishable)
);
create policy incidents_read on public.incidents for select to anon,authenticated using (
 exists(select 1 from public.runs where runs.id=incidents.run_id and published)
);
grant select on public.suites,public.tasks,public.runs,public.attempts,public.incidents to anon,authenticated;
grant all on public.suites,public.tasks,public.runs,public.attempts,public.incidents to service_role;
-- No public write policies, executable SQL RPC, or private grader tables.
commit;
