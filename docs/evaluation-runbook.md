# Manual native evaluation

There is no scheduler. Say **run evaluation** in Codex with this repository open.
`AGENTS.md` tells the coordinator how to execute the complete native workflow.
The script prepares, collects, grades and publishes; native tools in the chat
perform the model execution. No provider API execution is used.

## Requirements

- Signed-in Codex runtime exposing native subagent tools and all three exact models.
- Local native Codex JSONL session records with `turn_context.model` and `effort`.
- Node 22+ (development used Node 26), Python 3.12+, Docker engine.
- Supabase URL and write secret in ignored `.env.local`.
- Immutable task assets and `.private/answers.json` materialized by setup.

Run `npm ci`, `python3 -m venv .venv`, then
`.venv/bin/pip install -r requirements-eval.txt`. Run
`.venv/bin/python scripts/eval/build_panel.py` once to materialize deterministic
references. It refuses to overwrite a different frozen manifest.
Run `docker pull $(cat benchmarks/python-image.txt)` to install the pinned image.
`python scripts/eval/download_arc3.py` downloads the pinned official environment.
Run the reference validator once during setup, before a baseline:
`.venv/bin/python scripts/eval/validate_panel.py`.

## Running

1. `npm run eval:status` discovers an unfinished current run. Resume it after an
   interruption. Otherwise `npm run eval:prepare -- --key=<manual-trigger-id>`
   creates exactly 30 jobs and pins the 21-day freeze. Repeat keys reuse that run.
2. `plan.json` under ignored `.runs/<uuid>/` supplies names, model IDs and prompt
   paths. Spawn fresh agents with those exact names, models and medium effort.
   The runtime may cap concurrency below 15. Queue the rest, never drop jobs.
3. Task prompts define allowed assets and limits. Do not put private references
   or historical results in evaluator context. No hints or answer repair.
4. Immediately before an ARC3 evaluator, run
   `npx tsx scripts/eval/cli.ts broker <model>`. It writes a job-specific broker.json
   and frame.png. Agents interact with the actual pinned engine through local HTTP
   and image viewing. Four discrete actions, at most 160. The broker enforces the
   480-second interactive window from the first request; terminal report overhead
   is kept in end-to-end latency but is not an additional game action.
5. `npm run eval:grade` reads original final responses and actual configuration
   from the matching native logs. It checks all turns, retains token usage when
   exposed and records cost as null. Code runs in read-only, networkless Docker
   with a non-root user, memory/CPU/PID/file limits and hard process timeouts.
   Expected outputs remain in the host grader. ARC3 actions are independently
   replayed in a fresh official engine before accepting a score.
6. After 30 terminal observations: `npm run eval:publish`. All records are staged
   behind row-level security, then become public through one run publication
   switch. Repeating publication preserves an already-published record. Raw native
   logs/private references never deploy. Public tool traces redact broker tokens.
7. Verify the new run ID on the production `/api/observations` endpoint and inspect
   the public result. The site polls every 30 seconds and reads without caching.

## Failures and recovery

A wrong answer scores 0. An unverified runtime identity, missing environment,
unavailable grader, or native infrastructure fault scores null. Incomplete
model panels do not become accuracy points. A complete model can still be viewed
if another model’s panel is incomplete. Native task timeouts are separate from
wrong answers. Interrupt overdue agents; never silently extend task budgets.

If a task has no final response, `eval:grade` records an expired observed native
session as a timeout. Pending jobs that were never spawned remain pending.
Interrupted runs resume from terminal job files. The coordinator can restart a
broker only for a discarded setup-debug attempt before valid game actions; use a
fresh native agent name/context, update the plan, and never replace a completed
model answer to improve its score. The user requested that broken setup probes
not enter the public evaluation record.

Local state is private and should be backed up securely. Supabase is the durable
public record. Frozen suite hashes are checked against Supabase before writes;
a mismatch aborts publication. Keep reference corrections explicit and do not
rewrite published scores. A changed scientific protocol needs a new suite.

Native desktop subagents share a host filesystem. Scratch workspaces, fresh
contexts, tool profiles (where selectable), and explicit access constraints keep
references out of normal task execution, but are not adversarial OS isolation.
Do not describe this as a tamper-proof benchmark sandbox.
