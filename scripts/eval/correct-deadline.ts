// Append an audited classification correction; never overwrite original evidence.
import nextEnv from "@next/env";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
nextEnv.loadEnvConfig(process.cwd());
const workdir = resolve(process.argv[2] ?? "");
const a = JSON.parse(readFileSync(join(workdir, "attempt.json"), "utf8"));
const deadline = JSON.parse(
  readFileSync(join(workdir, "deadline.json"), "utf8"),
);
if (
  a.score !== null ||
  a.execution_status !== "timeout" ||
  !a.identity_evidence.verified ||
  deadline.kind !== "task_budget_exhausted" ||
  deadline.sessionId !== a.identity_evidence.session_id ||
  a.task_id !== "03-arc3"
)
  throw Error(
    "Requires a verified, coordinator-confirmed interactive task deadline",
  );
const grading = JSON.parse(
  execFileSync(
    resolve(".venv/bin/python"),
    [
      "scripts/eval/grade.py",
      a.task_id,
      join(workdir, "response.txt"),
      workdir,
    ],
    { encoding: "utf8", timeout: 60000 },
  )
    .trim()
    .split("\n")
    .at(-1)!,
);
if (
  grading.infrastructure_error ||
  !grading.replay_verified ||
  !grading.actions
)
  throw Error("Valid replayed task actions required");
const correction = {
  attempt_id: a.id,
  score: grading.score,
  execution_status: grading.score === 1 ? "success" : "task_error",
  grading: {
    ...grading,
    termination: "task_budget_exhausted",
    deadline_evidence: deadline,
  },
  reason:
    "Coordinator classification repair: the valid interactive attempt exhausted its fixed task budget. Independently replayed actions determine correctness; a final reporting message is not required. Original evidence retained.",
};
const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false } },
);
const old = await db
  .from("attempt_corrections")
  .select("attempt_id")
  .eq("attempt_id", a.id);
if (old.error) throw Error(old.error.message);
if (!old.data?.length) {
  const r = await db.from("attempt_corrections").insert(correction);
  if (r.error) throw Error(r.error.message);
}
console.log(
  JSON.stringify({
    attempt: a.id,
    correctedScore: grading.score,
    replayVerified: true,
  }),
);
