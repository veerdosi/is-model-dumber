import { describe, it, expect } from "vitest";
import { comparePanels, taskDiagnostics } from "../src/lib/measurement";
import { summarize } from "../src/lib/monitor";
import type { Attempt, Run } from "../src/lib/types";
const model = "gpt-6-luna";
const attempt = (
  run: string,
  task: string,
  score: number | null,
  grading: Record<string, unknown> = {},
): Attempt =>
  ({
    id: `${run}-${task}`,
    run_id: run,
    task_id: task,
    model,
    score,
    execution_status: score === null ? "infrastructure_error" : "success",
    grading,
    latency_ms: 100,
  }) as Attempt;
describe("within-model item comparisons", () => {
  it("reveals opposing item changes hidden by an unchanged total", () => {
    const before = Array.from({ length: 10 }, (_, i) =>
      attempt("before", String(i), i < 8 ? 1 : 0),
    );
    const after = before.map((a) => ({
      ...a,
      id: `after-${a.task_id}`,
      run_id: "after",
    }));
    after[0].score = 0;
    after[8].score = 1;
    expect(before.reduce((n, a) => n + a.score!, 0)).toBe(
      after.reduce((n, a) => n + a.score!, 0),
    );
    expect(comparePanels(before, after)).toMatchObject({
      compared: 10,
      improved: 1,
      worsened: 1,
      unchanged: 8,
    });
  });
  it("does not turn a native partial score into an extra strict pass", () => {
    expect(
      comparePanels([attempt("a", "t", 0.2)], [attempt("b", "t", 0.4)]),
    ).toMatchObject({ improved: 0, worsened: 0, unchanged: 1 });
  });
  it("does not count infrastructure failures as worsened answers", () => {
    expect(
      comparePanels([attempt("a", "task", 1)], [attempt("b", "task", null)]),
    ).toBeNull();
  });
  it("rejects changed item sets, duplicate items and different models", () => {
    const a = [attempt("a", "one", 1), attempt("a", "two", 0)];
    expect(
      comparePanels(a, [attempt("b", "one", 1), attempt("b", "other", 0)]),
    ).toBeNull();
    expect(
      comparePanels(a, [attempt("b", "one", 1), attempt("b", "one", 0)]),
    ).toBeNull();
    expect(
      comparePanels(
        a,
        a.map((x) => ({ ...x, run_id: "b", model: "gpt-6.1-sol" })),
      ),
    ).toBeNull();
  });
  it("does not invent a comparison from the first run or across suites", () => {
    const runs = [
      {
        id: "a",
        suite_id: "old",
        started_at: "2026-01-01",
        status: "complete",
      },
      {
        id: "b",
        suite_id: "new",
        started_at: "2026-01-02",
        status: "complete",
      },
    ] as Run[];
    const rows = runs.flatMap((r) =>
      Array.from({ length: 10 }, (_, i) => attempt(r.id, String(i), 1)),
    );
    const summary = summarize(model, rows, runs);
    expect(summary.changes).toBeNull();
    expect(summary.changesByRun.b).toBeNull();
  });
});
describe("native task diagnostics", () => {
  it("retains partial progress alongside strict failure without rescaling the score", () => {
    const row = attempt("a", "interactive", 0, {
      levels_completed: 2,
      win_levels: 7,
      actions: 160,
      official_efficiency_score: 10.714,
    });
    expect(taskDiagnostics(row)).toEqual([
      { label: "Levels completed", value: "2/7" },
      { label: "Actions", value: "160" },
      { label: "Environment efficiency", value: "10.71" },
    ]);
    expect(row.score).toBe(0);
  });
  it("shows actual check counts and preserves zero values", () => {
    expect(
      taskDiagnostics(attempt("a", "code", 0, { passed: 0, total: 24 })),
    ).toEqual([{ label: "Checks passed", value: "0/24" }]);
    expect(
      taskDiagnostics(
        attempt("a", "interactive", 0, {
          levels_completed: 0,
          win_levels: 7,
          official_efficiency_score: 0,
        }),
      ),
    ).toContainEqual({ label: "Environment efficiency", value: "0.00" });
  });
  it("compares native metrics only when their units and task identity match", () => {
    const before = attempt("a", "code", 0, { passed: 22, total: 24 });
    const after = attempt("b", "code", 1, { passed: 24, total: 24 });
    expect(taskDiagnostics(after, before)[0].change).toBe("+2");
    expect(
      taskDiagnostics(
        after,
        attempt("a", "code", 1, { passed: 24, total: 30 }),
      )[0].change,
    ).toBeUndefined();
    expect(
      taskDiagnostics(after, { ...before, model: "gpt-6.1-sol" })[0].change,
    ).toBeUndefined();
  });
  it("keeps missing, invalid, and failed-execution diagnostics unknown", () => {
    expect(taskDiagnostics(undefined)).toEqual([]);
    expect(taskDiagnostics(attempt("a", "t", 1))).toEqual([]);
    expect(
      taskDiagnostics(attempt("a", "t", null, { passed: 0, total: 10 })),
    ).toEqual([]);
    expect(
      taskDiagnostics(
        attempt("a", "t", 0, {
          passed: "0",
          total: 24,
          actions: NaN,
          official_efficiency_score: null,
        }),
      ),
    ).toEqual([]);
  });
});
