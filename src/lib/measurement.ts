import type { Attempt } from "./types";

export type ItemChange = {
  taskId: string;
  before: number;
  after: number;
  direction: "improved" | "worsened" | "unchanged";
};
export type PanelChanges = {
  previousRunId: string;
  compared: number;
  improved: number;
  worsened: number;
  unchanged: number;
  items: ItemChange[];
};
const scored = (a: Attempt) =>
  a.score !== null &&
  Number.isFinite(a.score) &&
  !["infrastructure_error", "timeout"].includes(a.execution_status);
/** Compare identical item sets within one model; never turn missing results into failures. */
export function comparePanels(
  previous: Attempt[],
  current: Attempt[],
): PanelChanges | null {
  if (
    !previous.length ||
    previous.length !== current.length ||
    ![...previous, ...current].every(scored)
  )
    return null;
  const model = current[0].model;
  if ([...previous, ...current].some((a) => a.model !== model)) return null;
  const before = new Map(previous.map((a) => [a.task_id, a]));
  if (
    before.size !== previous.length ||
    new Set(current.map((a) => a.task_id)).size !== current.length ||
    current.some((a) => !before.has(a.task_id))
  )
    return null;
  const items = current.map((a) => {
    const b = before.get(a.task_id)!;
    return {
      taskId: a.task_id,
      before: b.score!,
      after: a.score!,
      direction: (Number(a.score === 1) > Number(b.score === 1)
        ? "improved"
        : Number(a.score === 1) < Number(b.score === 1)
          ? "worsened"
          : "unchanged") as ItemChange["direction"],
    };
  });
  return {
    previousRunId: previous[0].run_id,
    compared: items.length,
    improved: items.filter((a) => a.direction === "improved").length,
    worsened: items.filter((a) => a.direction === "worsened").length,
    unchanged: items.filter((a) => a.direction === "unchanged").length,
    items,
  };
}
export type Diagnostic = { label: string; value: string; change?: string };
/** Display measured grader outputs in their native units; no synthetic partial-credit score. */
export function taskDiagnostics(
  attempt: Attempt | undefined,
  previous?: Attempt,
): Diagnostic[] {
  if (!attempt || !scored(attempt)) return [];
  const g = attempt.grading;
  const result: Diagnostic[] = [];
  const prior =
    previous &&
    scored(previous) &&
    previous.model === attempt.model &&
    previous.task_id === attempt.task_id &&
    (!g.protocol || previous.grading.protocol === g.protocol)
      ? previous.grading
      : null;
  const numeric = (v: unknown): v is number =>
    typeof v === "number" && Number.isFinite(v);
  if (numeric(g.passed) && numeric(g.total) && g.total > 0)
    result.push({ label: "Checks passed", value: `${g.passed}/${g.total}` });
  if (numeric(g.levels_completed) && numeric(g.win_levels) && g.win_levels > 0)
    result.push({
      label: "Levels completed",
      value: `${g.levels_completed}/${g.win_levels}`,
    });
  if (numeric(g.actions))
    result.push({ label: "Actions", value: String(g.actions) });
  if (numeric(g.official_efficiency_score))
    result.push({
      label: "Environment efficiency",
      value: g.official_efficiency_score.toFixed(2),
    });
  const metrics: Record<
    string,
    { key: string; denominator?: string; precision: number }
  > = {
    "Checks passed": { key: "passed", denominator: "total", precision: 0 },
    "Levels completed": {
      key: "levels_completed",
      denominator: "win_levels",
      precision: 0,
    },
    Actions: { key: "actions", precision: 0 },
    "Environment efficiency": {
      key: "official_efficiency_score",
      precision: 2,
    },
  };
  if (prior)
    for (const diagnostic of result) {
      const m = metrics[diagnostic.label];
      if (
        !numeric(prior[m.key]) ||
        !numeric(g[m.key]) ||
        (m.denominator && prior[m.denominator] !== g[m.denominator])
      )
        continue;
      const delta = (g[m.key] as number) - (prior[m.key] as number);
      if (delta !== 0)
        diagnostic.change = `${delta > 0 ? "+" : ""}${delta.toFixed(m.precision)}`;
    }
  return result;
}
