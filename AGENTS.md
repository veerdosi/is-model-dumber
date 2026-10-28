# isModelDumber

## “run evaluation” means execute the whole workflow

Do not use a provider SDK, OpenAI HTTP API, or `codex exec` per-model process.
Use the native collaboration subagent tools, fresh contexts (`fork_turns="none"`),
explicit model overrides and `reasoning_effort="medium"`. Exactly these models:
`gpt-6.1-terra`, `gpt-6-luna`, `gpt-6.1-sol`. Never substitute.

1. Read `docs/evaluation-runbook.md`. Run `npm run eval:status` to find unfinished
   work. Resume the current unfinished run; do not create duplicates. If complete,
   `npm run eval:prepare -- --key=<unique-manual-trigger-id>` creates 30 jobs.
2. Native tool availability is authoritative. Queue all 30 independent model-item
   jobs. Maximum 15 concurrently, or fewer when runtime capacity is smaller. The
   current desktop tool has four total slots including the coordinator: normally
   three active evaluators. Continue batches until all 30 finish.
3. For each job, spawn its exact planned `agent` name, explicit `model`, medium
   reasoning and fresh context. Tell it to read ONLY `promptPath`, use only its
   job directory for scratch, obey the 480-second budget and return the specified
   JSON. Do not send grader source, answers, or historical responses. Custom agents
   in `.codex/agents/` encode the same settings when custom-agent selection exists.
   Do not claim these profiles restrict tools when using a runtime that cannot
   select them. Native tools in this desktop session share host filesystem access;
   isolation is protocol-enforced, not an adversarial security boundary.
4. Immediately before each `03-arc3` spawn, run
   `npx tsx scripts/eval/cli.ts broker <exact-model>`. Wait for that job's broker.json
   and frame.png. Tell only that evaluator to read its broker.json, GET state and
   POST {"action":1|2|3|4} with its Bearer token; inspect frame.png with image tools.
   Never expose environment source or let agents use another job's broker. Brokers
   expire after the fixed budget. The real official engine is mandatory.
5. Enforce limits with native interrupts if an evaluator is still working at
   480 seconds. No coaching, hints, response repair, or extra solving turns.
6. `npm run eval:grade` collects final responses and configuration from native
   Codex session JSONL, checks every turn's actual model and reasoning effort, and
   grades independently. It collects only matching agent paths for this run.
   Missing identity, grader errors, or timeout must not become incorrect scores.
   If a local setup/broker bug occurs before any valid task actions, fix it and
   replace that setup attempt with a fresh independent context; the user explicitly
   asked not to publish setup-debug failures. Genuine evaluation failures remain
   distinct from wrong answers and retain their evidence.
7. Once all 30 jobs have terminal records, run `npm run eval:publish`. It stages
   all rows before one publication switch; idempotent repeats do not rewrite
   published evidence. It inserts real data into Supabase; the site refreshes
   without redeployment. Confirm `/api/observations` on the production URL includes
   this run ID and its 30 records.
8. Report per-model passed/scored counts, changes, unavailable tasks, measured
   latency and token counts. Report monetary cost as unavailable when the native
   subscription runtime does not expose billing. First observations have no trend.

The panel is fixed for 21 days. Never generate, rotate, replace or edit an item,
prompt, grader, seed, or budget during that period. Infrastructure adapters can be
repaired with provenance. No scheduling, Cron, or automatic evaluations.

## Build and maintenance

Next.js + TypeScript + Tailwind + shadcn-style UI primitives + Recharts. Supabase
PostgreSQL is the only public observation source. No demo/synthetic fallback data.
Keep `.env.local`, `.runs`, `.private`, and official game source out of Git and
Vercel bundles. Never print credentials. Only public-read keys belong on Vercel;
the local coordinator owns the write secret and management token.

Required useful checks: `npm test`, `npm run typecheck`, `npm run build`. For a
grader/reference change, run independent `scripts/eval/validate_panel.py` before
any baseline. Do not add cosmetic tests that simply mirror implementation.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
