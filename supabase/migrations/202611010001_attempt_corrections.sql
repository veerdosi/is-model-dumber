begin;
create table if not exists public.attempt_corrections (
 attempt_id uuid primary key references public.attempts(id),
 score double precision not null check(score between 0 and 1),
 execution_status text not null check(execution_status in ('task_error','success')),
 grading jsonb not null,
 reason text not null,
 created_at timestamptz not null default now()
);
alter table public.attempt_corrections enable row level security;
create policy corrections_read on public.attempt_corrections for select to anon,authenticated using (
 exists(select 1 from public.attempts where attempts.id=attempt_corrections.attempt_id)
);
grant select on public.attempt_corrections to anon,authenticated;
grant select,insert on public.attempt_corrections to service_role;
commit;
