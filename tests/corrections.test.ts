import { describe, it, expect } from "vitest";
import { applyCorrections, correctedRuns } from "../src/lib/corrections";
import type { Attempt, Run } from "../src/lib/types";

describe("audited classification repairs", () => {
  const original = {
    id: "a",
    run_id: "r",
    score: null,
    execution_status: "timeout",
    grading: { infrastructure_error: "missing final" },
    error: { message: "missing final" },
    response_hash: "unchanged",
    actions: [{ action: 1 }],
  } as unknown as Attempt;
  const correction = {
    attempt_id: "a",
    score: 0,
    execution_status: "task_error" as const,
    grading: { score: 0, replay_verified: true },
    reason: "Confirmed task deadline",
    created_at: "2026-11-01T00:00:00Z",
  };
  it("scores valid budget exhaustion while preserving original evidence and classification", () => {
    const [a] = applyCorrections([original], [correction]);
    expect(a.score).toBe(0);
    expect(a.execution_status).toBe("task_error");
    expect(a.response_hash).toBe(original.response_hash);
    expect(a.actions).toBe(original.actions);
    expect(a.correction?.original.score).toBeNull();
    expect(original.score).toBeNull();
  });
  it("does not turn an uncorrected infrastructure fault into an answer", () => {
    expect(applyCorrections([original], [])[0]).toBe(original);
    const run = { id: "r", status: "partial" } as Run;
    const rows = Array.from({ length: 30 }, () => original);
    expect(correctedRuns([run], rows)[0].status).toBe("partial");
  });
  it("includes corrected failures in a complete panel without inventing missing observations", () => {
    const run = { id: "r", status: "partial" } as Run;
    const rows = Array.from({ length: 30 }, (_, i) => ({
      ...original,
      id: String(i),
      task_id: String(i % 10),
      model: ["gpt-6.1-terra", "gpt-6-luna", "gpt-6.1-sol"][Math.floor(i / 10)],
      score: 0,
    })) as Attempt[];
    expect(correctedRuns([run], rows)[0].status).toBe("complete");
    expect(correctedRuns([run], rows.slice(1))[0].status).toBe("partial");
  });
});
