import type { Attempt, Model, Run } from "./types";
import { comparePanels } from "./measurement";
export type Verdict =
  | "insufficient_evidence"
  | "observing"
  | "healthy"
  | "possible_regression"
  | "supported_change"
  | "recovery";
// Runs are the unit of replication. Repeated answers to a fixed item are never independent new items.
export function summarize(model: Model, attempts: Attempt[], runs: Run[]) {
  const validRuns = runs
    .filter((r) => ["complete", "partial"].includes(r.status))
    .sort((a, b) => a.started_at.localeCompare(b.started_at));
  const series = validRuns.flatMap((run) => {
    const all = attempts.filter(
      (a) => a.model === model && a.run_id === run.id,
    );
    const scored = all.filter(
      (a) =>
        a.score !== null &&
        a.execution_status !== "infrastructure_error" &&
        a.execution_status !== "timeout",
    );
    if (
      all.length !== 10 ||
      scored.length !== 10 ||
      new Set(scored.map((a) => a.task_id)).size !== 10
    )
      return [];
    return [
      {
        runId: run.id,
        suiteId: run.suite_id,
        time: run.started_at,
        score: scored.reduce((s, a) => s + (a.score ?? 0), 0) / 10,
        latency: median(
          all.flatMap((a) => (a.latency_ms === null ? [] : [a.latency_ms])),
        ),
        items: scored,
      },
    ];
  });
  const latest = series.at(-1);
  const comparable = series.filter((p) => p.suiteId === latest?.suiteId);
  const changesByRun = Object.fromEntries(
    comparable.map((point, index) => [
      point.runId,
      index > 0
        ? comparePanels(comparable[index - 1].items, point.items)
        : null,
    ]),
  );
  const changes = latest ? (changesByRun[latest.runId] ?? null) : null;
  const baseline = comparable.slice(0, 6);
  const recent = comparable.slice(-3);
  const baselineMean = baseline.length
    ? baseline.reduce((s, p) => s + p.score, 0) / baseline.length
    : null;
  const delta =
    latest && baselineMean !== null ? latest.score - baselineMean : null;
  let status: Verdict =
    comparable.length === 0 ? "insufficient_evidence" : "observing";
  let pairedLosses = 0,
    pairedGains = 0,
    pValue: number | null = null;
  if (comparable.length >= 9) {
    const differences = latest!.items.map((item) => {
      const before =
        baseline
          .map(
            (p) =>
              p.items.find((a) => a.task_id === item.task_id)!.score as number,
          )
          .reduce((a, b) => a + b, 0) / 6;
      const after =
        recent
          .map(
            (p) =>
              p.items.find((a) => a.task_id === item.task_id)!.score as number,
          )
          .reduce((a, b) => a + b, 0) / 3;
      return after - before;
    });
    pairedLosses = differences.filter((d) => d < -0.001).length;
    pairedGains = differences.filter((d) => d > 0.001).length;
    const n = pairedLosses + pairedGains;
    const k = Math.min(pairedLosses, pairedGains);
    pValue = n
      ? Math.min(
          1,
          (2 *
            Array.from({ length: k + 1 }, (_, i) => choose(n, i)).reduce(
              (a, b) => a + b,
              0,
            )) /
            2 ** n,
        )
      : 1;
    const recentMean = recent.reduce((s, p) => s + p.score, 0) / 3;
    const change = recentMean - baselineMean!;
    // Exploratory sign test only; no confirmed significance under serial dependence / repeated monitoring.
    status =
      change <= -0.1 && recent.every((p) => p.score < baselineMean! - 0.05)
        ? "possible_regression"
        : "healthy";
    const prior = comparable.slice(-6, -3);
    if (
      status === "healthy" &&
      prior.length === 3 &&
      prior.every((p) => p.score < baselineMean! - 0.1) &&
      recent.every((p) => p.score >= baselineMean! - 0.05)
    )
      status = "recovery";
  }
  const all = attempts.filter((a) => a.model === model);
  const errors = all.filter(
    (a) =>
      a.execution_status === "infrastructure_error" ||
      a.execution_status === "timeout",
  ).length;
  const variability = latest
    ? latest.items.map((item) => {
        const values = comparable
          .map((p) => p.items.find((a) => a.task_id === item.task_id)?.score)
          .filter((v): v is number => v !== null && v !== undefined);
        return {
          taskId: item.task_id,
          mean: values.reduce((a, b) => a + b, 0) / values.length,
          flips: values.slice(1).filter((v, i) => v !== values[i]).length,
          n: values.length,
        };
      })
    : [];
  return {
    model,
    status,
    series: comparable,
    latest,
    baselineMean,
    delta,
    errors,
    total: all.length,
    changes,
    changesByRun,
    pairedLosses,
    pairedGains,
    pValue,
    variability,
  };
}
function choose(n: number, k: number) {
  let v = 1;
  for (let i = 1; i <= k; i++) v = (v * (n - i + 1)) / i;
  return v;
}
export function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return (
    (s[Math.floor((s.length - 1) / 2)] + s[Math.ceil((s.length - 1) / 2)]) / 2
  );
}
export const STATUS_LABELS: Record<Verdict, string> = {
  insufficient_evidence: "Awaiting observations",
  observing: "Establishing baseline",
  healthy: "No persistent decline observed",
  possible_regression: "Possible regression",
  supported_change: "Supported change",
  recovery: "Recovery observed",
};
