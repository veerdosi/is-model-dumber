import type { Attempt, Run } from "./types";

export type AttemptCorrection = {
  attempt_id: string;
  score: number;
  execution_status: "task_error" | "success";
  grading: Record<string, unknown>;
  reason: string;
  created_at: string;
};

// Original observations remain immutable; exports retain the original classification.
export function applyCorrections(
  attempts: Attempt[],
  corrections: AttemptCorrection[],
): Attempt[] {
  const byId = new Map(corrections.map((c) => [c.attempt_id, c]));
  return attempts.map((a) => {
    const c = byId.get(a.id);
    if (!c) return a;
    return {
      ...a,
      score: c.score,
      execution_status: c.execution_status,
      grading: c.grading,
      error: null,
      correction: {
        reason: c.reason,
        created_at: c.created_at,
        original: {
          score: a.score,
          execution_status: a.execution_status,
          grading: a.grading,
          error: a.error,
        },
      },
    };
  });
}

export function correctedRuns(runs: Run[], attempts: Attempt[]): Run[] {
  return runs.map((run) => {
    const rows = attempts.filter((a) => a.run_id === run.id);
    return run.status === "partial" &&
      rows.length === 30 &&
      new Set(rows.map((a) => `${a.model}:${a.task_id}`)).size === 30 &&
      rows.every((a) => a.score !== null)
      ? { ...run, status: "complete" }
      : run;
  });
}
