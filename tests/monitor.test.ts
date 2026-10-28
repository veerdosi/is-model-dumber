import { describe, it, expect } from "vitest";
import { summarize, median } from "../src/lib/monitor";
import { type Attempt, type Run } from "../src/lib/types";
const model = "gpt-6.1-sol";
// Synthetic test fixtures stay in unit tests; never inserted into production storage.
function fixture(scores: number[], partial = false) {
  const runs = scores.map(
    (_, i) =>
      ({
        id: `r${i}`,
        suite_id: "test-panel",
        started_at: new Date(Date.UTC(2026, 0, i + 1)).toISOString(),
        status: partial && i === scores.length - 1 ? "partial" : "complete",
      }) as Run,
  );
  const attempts = runs.flatMap((r, i) =>
    Array.from(
      { length: 10 },
      (_, j) =>
        ({
          id: `a${i}-${j}`,
          run_id: r.id,
          task_id: `t${j}`,
          model,
          score: j < scores[i] ? 1 : 0,
          execution_status: "success",
          latency_ms: 100,
        }) as Attempt,
    ),
  );
  return { runs, attempts };
}
describe("conservative fixed-panel monitoring", () => {
  it("makes no trend claim for one or eight observations", () => {
    for (const n of [1, 8]) {
      const f = fixture(Array(n).fill(7));
      expect(summarize(model, f.attempts, f.runs).status).toBe("observing");
    }
  });
  it("excludes partial observations and infrastructure failures", () => {
    const f = fixture([7, 7], true);
    f.attempts[19].execution_status = "infrastructure_error";
    f.attempts[19].score = null;
    expect(summarize(model, f.attempts, f.runs).series).toHaveLength(1);
    f.runs[1].status = "complete";
    const s = summarize(model, f.attempts, f.runs);
    expect(s.series).toHaveLength(1);
    expect(s.errors).toBe(1);
  });
  it("requires three persistent below-baseline observations", () => {
    const f = fixture([8, 8, 8, 8, 8, 8, 5, 8, 5]);
    expect(summarize(model, f.attempts, f.runs).status).toBe("healthy");
    const g = fixture([8, 8, 8, 8, 8, 8, 5, 5, 5]);
    expect(summarize(model, g.attempts, g.runs).status).toBe(
      "possible_regression",
    );
    expect(summarize(model, g.attempts, g.runs).status).not.toBe(
      "supported_change",
    );
  });
  it("detects recovery without rewriting the baseline", () => {
    const f = fixture([8, 8, 8, 8, 8, 8, 5, 5, 5, 8, 8, 8]);
    const s = summarize(model, f.attempts, f.runs);
    expect(s.status).toBe("recovery");
    expect(s.baselineMean).toBeCloseTo(0.8);
  });
  it("never combines different suite versions", () => {
    const f = fixture(Array(12).fill(8));
    f.runs[11].suite_id = "new-panel";
    const s = summarize(model, f.attempts, f.runs);
    expect(s.series).toHaveLength(1);
    expect(s.status).toBe("observing");
  });
  it("retains item flips without treating repeated answers as fresh items", () => {
    const f = fixture([8, 7, 8]);
    const s = summarize(model, f.attempts, f.runs);
    expect(s.variability.find((v) => v.taskId === "t7")?.flips).toBe(2);
    expect(s.variability[0].n).toBe(3);
  });
  it("keeps missing duration unknown", () => {
    expect(median([])).toBeNull();
    expect(median([10, 30, 20, 40])).toBe(25);
  });
});
