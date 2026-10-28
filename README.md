# isModelDumber

A public observatory for changes in native Codex subagent performance. Next.js,
TypeScript, Tailwind CSS, shadcn-style Radix button primitives, Recharts, Supabase
PostgreSQL, and Vercel. It uses real persistent observations; an empty database
produces an empty state, never synthetic history.

## Develop

```sh
npm ci
cp .env.example .env.local
# Fill in the Supabase project URL, publishable key, and local write secret.
npm run dev
```

The website needs only `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. All public reads obey PostgreSQL row-level
security. The server write secret and management token belong only in the local
coordinator environment. There is no public evaluation-trigger or write API.

To create the schema, set either `DATABASE_URL` or
`SUPABASE_ACCESS_TOKEN` plus `SUPABASE_PROJECT_REF`, then `npm run db:migrate`.
A project secret is not a database administration credential. Migrations live in
`supabase/migrations/`. A PostgreSQL connection applies them once using a migration
ledger. Management API application is intended for fresh project provisioning.

## Run evaluation

Say **run evaluation** to Codex in this repository. `AGENTS.md` supplies the full
procedure. It queues 30 fresh native subagents, one for each of ten tasks on
`gpt-6.1-terra`, `gpt-6-luna`, and `gpt-6.1-sol`, with explicit medium reasoning.
It uses up to 15 concurrent evaluators when the native runtime permits; smaller
limits are handled in batches. No separate model API calls or scheduler are used.

See [evaluation setup and recovery](docs/evaluation-runbook.md). The commands are:

```sh
npm run eval:prepare -- --key=<unique-manual-trigger-id>
# Codex now spawns the planned independent native agents.
npm run eval:grade
npm run eval:publish
```

`eval:prepare` reuses an existing idempotency key. Local run plans, private answers,
raw native logs, and official game source never enter Git or the Vercel bundle.
`eval:grade` verifies identity/settings using actual native `turn_context` records,
not a model’s self-description. Responses and actions are graded independently.
`eval:publish` stages a complete run before switching public visibility once.
The website reads fresh data every 30 seconds; no redeployment is needed.

The first task panel stays fixed for 21 days. This is a diagnostic pilot, not an
official full-benchmark score or a calibrated optimal item panel. Native desktop
agents share the host filesystem: reference isolation uses fresh contexts,
restricted task workspaces and protocol rules, not an adversarial OS boundary.

## Verify and deploy

```sh
npm test
npm run typecheck
npm run build
npx vercel link
# Set only the two public-read Supabase variables for production.
npx vercel --prod
```

Production uses dynamic routes, explicit no-store data fetching, security headers,
server-side public-key reads, and polling. Original responses and action traces
load on demand, keeping the overview small. The overview leads with within-model item changes; strict task completion is a
secondary count. Task pages retain native grader diagnostics and observed outcome
flips, without a replacement intelligence index. Charts preserve gaps: one run
can form a completion point but cannot form a change comparison.

## Documentation

- [Benchmark selection, alternatives, and license assessment](docs/benchmark-selection.md)
- [Independent reference validation](docs/panel-validation.json)
- [Statistical protocol and research sources](docs/statistics.md)
- [Native evaluation runbook](docs/evaluation-runbook.md)
- [Setup causes and fixes](docs/setup-fixes.md)

No automatic significance claims, task rotation, IRT, or adaptive selection are
implemented. Task failures, execution failures and unknown costs stay distinct.
