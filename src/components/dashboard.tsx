"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  FlaskConical,
  GitBranch,
  Info,
  Menu,
  Moon,
  RefreshCw,
  Search,
  ShieldCheck,
  Sun,
  Terminal,
  X,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "./ui/button";
import {
  MODELS,
  MODEL_NAMES,
  MODEL_COLORS,
  type Model,
  type Snapshot,
  type Attempt,
} from "@/lib/types";
import { summarize, STATUS_LABELS, median } from "@/lib/monitor";
import { cn } from "@/lib/utils";
import { taskDiagnostics } from "@/lib/measurement";
type View = "overview" | "model" | "evidence" | "incidents" | "methodology";
function date(t: string, full = false) {
  const d = new Date(t);
  const month = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ][d.getUTCMonth()];
  const day = `${month} ${d.getUTCDate()}`;
  return full
    ? `${day}, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`
    : day;
}
function score(n: number | null | undefined) {
  return n == null ? "—" : `${Math.round(n * 100)}%`;
}
function duration(n: number | null | undefined) {
  return n == null ? "—" : n < 1000 ? `${n} ms` : `${(n / 1000).toFixed(1)} s`;
}
export function Dashboard({
  initial,
  view,
  model,
}: {
  initial: Snapshot;
  view: View;
  model?: Model;
}) {
  const [data, setData] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [days, setDays] = useState(30);
  const [metric, setMetric] = useState<"changes" | "score" | "latency">(
    "changes",
  );
  const [visible, setVisible] = useState<Model[]>(
    model ? [model] : [...MODELS],
  );
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Attempt | null>(null);
  const [copied, setCopied] = useState(false);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState(false);
  const [mobile, setMobile] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  async function refresh() {
    setRefreshing(true);
    try {
      const r = await fetch("/api/observations", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) {
        setFetchFailed(true);
        return;
      }
      setData(d);
      setFetchFailed(false);
    } catch {
      setFetchFailed(true);
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => {
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const d = Number(p.get("days"));
    if ([7, 30, 90].includes(d)) setDays(d);
    const requested = p.get("metric");
    if (requested && ["changes", "score", "latency"].includes(requested))
      setMetric(requested as "changes" | "score" | "latency");
  }, []);
  useEffect(() => {
    if (!selected) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", h);
    return () => {
      document.body.style.overflow = old;
      window.removeEventListener("keydown", h);
    };
  }, [selected]);
  const summaries = useMemo(
    () =>
      MODELS.map((m) => {
        const summary = summarize(m, data.attempts, data.runs);
        const rows = data.attempts.filter(
          (a) =>
            a.model === m && a.run_id === data.runs[0]?.id && a.score !== null,
        );
        return {
          ...summary,
          partial:
            rows.length > 0 && rows.length < 10
              ? {
                  passed: rows.filter((a) => a.score === 1).length,
                  scored: rows.length,
                  items: rows,
                }
              : null,
        };
      }),
    [data],
  );
  const active = model ? summaries.find((s) => s.model === model)! : null;
  const hasRegressions = summaries.some(
    (s) => s.status === "possible_regression",
  );
  const baselinesReady = summaries.every(
    (s) => !["observing", "insufficient_evidence"].includes(s.status),
  );
  const cutoff = Date.parse(data.fetchedAt) - days * 86400000;
  const chartRows = data.runs
    .filter(
      (r) =>
        ["complete", "partial"].includes(r.status) &&
        Date.parse(r.started_at) >= cutoff,
    )
    .sort((a, b) => a.started_at.localeCompare(b.started_at))
    .map((r) => {
      const row: Record<string, string | number | null> = {
        time: Date.parse(r.started_at),
        label: date(r.started_at, true),
      };
      for (const s of summaries) {
        const p = s.series.find((p) => p.runId === r.id);
        const change = s.changesByRun[r.id];
        row[`${s.model}_improved`] = change?.improved ?? null;
        row[`${s.model}_worsened`] = change?.worsened ?? null;
        row[`${s.model}_unchanged`] = change?.unchanged ?? null;
        row[s.model] = !p
          ? null
          : metric === "changes"
            ? change
              ? change.improved + change.worsened
              : null
            : metric === "score"
              ? p.items.filter((a) => a.score === 1).length
              : p.latency === null
                ? null
                : p.latency / 1000;
      }
      return row;
    });
  const chartHasData = chartRows.some((r) =>
    visible.some((m) => r[m] !== null),
  );
  const shownAttempts = data.attempts.filter(
    (a) =>
      (!model || a.model === model) &&
      (filter === "all" ||
        a.model === filter ||
        a.execution_status === filter) &&
      `${a.model} ${a.task_id} ${data.tasks.find((t) => t.id === a.task_id)?.title ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  async function openEvidence(attempt: Attempt) {
    setSelected(attempt);
    setEvidenceLoading(true);
    setEvidenceError(false);
    try {
      const r = await fetch(`/api/attempts/${attempt.id}`, {
        cache: "no-store",
      });
      if (r.ok) {
        const full = await r.json();
        setSelected((current) => (current?.id === attempt.id ? full : current));
      } else setEvidenceError(true);
    } catch {
      setEvidenceError(true);
    } finally {
      setEvidenceLoading(false);
    }
  }
  const latest = data.runs[0];
  async function share() {
    const url = new URL(location.href);
    url.searchParams.set("days", String(days));
    url.searchParams.set("metric", metric);
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy chart link", url.toString());
    }
  }
  const nav = [
    ["/", "Overview"],
    ["/incidents", "Incidents"],
    ["/about", "About"],
  ];
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link href="/" className="brand" aria-label="isModelDumber home">
            <span className="brand-mark">
              <Activity size={20} />
            </span>
            isModel<span>Dumber</span>
          </Link>
          <nav
            className={cn("main-nav", mobile && "mobile-open")}
            aria-label="Main navigation"
          >
            {nav.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                aria-current={
                  (
                    href === "/"
                      ? view === "overview" || view === "model"
                      : href === `/${view}` ||
                        (href === "/about" && view === "methodology")
                  )
                    ? "page"
                    : undefined
                }
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <a
              href="https://github.com/veerdosi/is-model-dumber"
              className="source-link"
              target="_blank"
              rel="noreferrer"
            >
              Source <ArrowUpRight size={13} />
            </a>
            <span className="vertical-rule" />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle color theme"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
            >
              <Sun size={17} className="sun" />
              <Moon size={17} className="moon" />
            </Button>
            <Button
              className="mobile-toggle"
              variant="ghost"
              size="icon"
              aria-label="Toggle navigation"
              onClick={() => setMobile(!mobile)}
            >
              {mobile ? <X size={18} /> : <Menu size={18} />}
            </Button>
          </div>
        </div>
      </header>
      <main id="main" className="page-shell">
        <div className="context-bar">
          <div>
            <span
              className={cn(
                "status-dot",
                data.state === "connected" && !fetchFailed ? "live" : "muted",
              )}
            />
            <span>
              {fetchFailed
                ? "Refresh failed · showing last fetched data"
                : data.state === "connected"
                  ? "Connected to live observations"
                  : data.state === "unconfigured"
                    ? "Data connection not configured"
                    : "Observation feed unavailable"}
            </span>
          </div>
          <button onClick={refresh} disabled={refreshing} className="refresh">
            <RefreshCw size={12} className={refreshing ? "spinning" : ""} />
            {refreshing
              ? "Refreshing"
              : `Updated ${date(data.fetchedAt, true)}`}
          </button>
        </div>
        {(view === "overview" || view === "model") && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow">
                  <span className="tiny-cross">+</span> INDEPENDENT PERFORMANCE
                  MONITOR{" "}
                </div>
                <h1>
                  {model ? (
                    <>
                      {MODEL_NAMES[model]}
                      <br />
                      <span>Under observation.</span>
                    </>
                  ) : (
                    <>
                      Is ChatGPT
                      <br />
                      getting <span className="serif-word">dumber?</span>
                    </>
                  )}
                </h1>
                <p>
                  {model
                    ? "A longitudinal record of this model’s performance. Every observation uses the same fixed tasks and medium reasoning."
                    : "We repeat the same ten tasks on three models."}
                </p>
                <div className="hero-links">
                  <Link href="/about">
                    About the project <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
              <aside
                className={cn("verdict-panel", hasRegressions && "warning")}
              >
                <div className="eyebrow">
                  {model ? "MODEL VERDICT" : "THE CURRENT VERDICT"}
                  <span className="signal-icon">
                    <Activity size={16} />
                  </span>
                </div>
                <div className="verdict-indicator">
                  <span
                    className={cn(
                      "status-dot",
                      hasRegressions
                        ? "amber"
                        : baselinesReady
                          ? "live"
                          : "muted",
                    )}
                  />
                  {model
                    ? active!.partial
                      ? "Partial result published"
                      : STATUS_LABELS[active!.status]
                    : hasRegressions
                      ? "A signal worth investigating"
                      : baselinesReady
                        ? "No persistent decline observed"
                        : data.attempts.length
                          ? "Establishing a baseline."
                          : "Awaiting first results."}
                </div>
                <p>
                  {model
                    ? active!.latest
                      ? `${active!.series.length} complete observation${active!.series.length === 1 ? "" : "s"}. ${active!.status === "observing" ? "More comparable runs are needed before assessing change." : "Compare changes with item-level evidence below."}`
                      : active!.partial
                        ? `${active!.partial.passed} of ${active!.partial.scored} graded tasks passed. The remaining task is not included.`
                        : "No complete, comparable observation is available yet."
                    : hasRegressions
                      ? "At least one model shows a persistent decline on this task panel. This is an exploratory signal, not a confirmed change in general intelligence."
                      : baselinesReady
                        ? "Recent observations do not show a persistent decline on this fixed task panel. This does not establish that capabilities are unchanged."
                        : "The baseline is still being collected."}
                </p>
                <div className="verdict-meta-inline">
                  <span>
                    {data.runs.length} published evaluation
                    {data.runs.length === 1 ? "" : "s"}
                  </span>
                  <i />
                  <span>{data.tasks.length} fixed tasks</span>
                  <i />
                  <span>Medium reasoning</span>
                </div>
              </aside>
            </section>
            <section id="models">
              <div className="section-heading">
                <div>
                  <h2>
                    {model ? "Observation details" : "Models under observation"}
                  </h2>
                </div>
                <span className="section-note">
                  Compared against their own history
                </span>
              </div>
              <div className="model-table">
                <div className="model-table-head">
                  <span>Model / execution</span>
                  <span>Outcome changes</span>
                  <span>Task completion</span>
                  <span>Median latency</span>
                  <span>Signal</span>
                  <span />
                </div>
                {summaries
                  .filter((s) => !model || s.model === model)
                  .map((s) => (
                    <Link
                      key={s.model}
                      href={`/models/${s.model}`}
                      className="model-row"
                    >
                      <div className="model-identity">
                        <span
                          className="model-glyph"
                          style={{ color: MODEL_COLORS[s.model] }}
                        >
                          <GitBranch size={18} />
                        </span>
                        <div>
                          <strong>{MODEL_NAMES[s.model]}</strong>
                          <span>
                            Native subagent <i /> medium
                          </span>
                        </div>
                      </div>
                      <div
                        className={cn(
                          "model-change",
                          s.changes && s.changes.worsened > 0 && "has-losses",
                        )}
                        aria-label={
                          s.changes
                            ? `${s.changes.worsened} tasks worsened, ${s.changes.improved} improved, ${s.changes.unchanged} unchanged compared with this model's previous run`
                            : "A second complete run is needed for comparison"
                        }
                      >
                        {s.changes ? (
                          <span>
                            <span className="outcome-loss">
                              ↓ {s.changes.worsened}
                            </span>
                            <span className="outcome-gain">
                              ↑ {s.changes.improved}
                            </span>
                          </span>
                        ) : (
                          <span>{s.latest ? "First run" : "—"}</span>
                        )}
                        <small>
                          {s.changes
                            ? `${s.changes.unchanged} unchanged · vs. previous`
                            : s.latest
                              ? "Awaiting repeat"
                              : "—"}
                        </small>
                      </div>
                      <div className="model-score secondary-completion">
                        {s.latest
                          ? `${s.latest.items.filter((a) => a.score === 1).length}/10`
                          : s.partial
                            ? `${s.partial.passed}/${s.partial.scored}`
                            : "—"}
                        <small>
                          {s.latest
                            ? "strict passes"
                            : s.partial
                              ? "partial panel"
                              : "Awaiting result"}
                        </small>
                      </div>
                      <div>
                        {duration(s.latest?.latency)}
                        <small>
                          {s.errors
                            ? `${s.errors} infrastructure failures`
                            : "End-to-end"}
                        </small>
                      </div>
                      <div>
                        <span
                          className={cn(
                            "status-badge",
                            s.status === "possible_regression" && "warn",
                          )}
                        >
                          <span className="status-dot" />
                          {s.status === "insufficient_evidence"
                            ? s.partial
                              ? "Partial result"
                              : "Awaiting data"
                            : s.status === "observing"
                              ? s.series.length === 1
                                ? "First observation"
                                : "Observing"
                              : s.status === "possible_regression"
                                ? "Investigating"
                                : s.status === "recovery"
                                  ? "Recovering"
                                  : "Observing"}
                        </span>
                      </div>
                      <ArrowUpRight size={16} className="row-arrow" />
                    </Link>
                  ))}
              </div>
            </section>
            <section className="monitor-section">
              <div className="section-heading">
                <div>
                  <h2>
                    {model
                      ? "Changes within this model"
                      : "Changes within each model"}
                  </h2>
                </div>
                <span className="section-note">
                  Ten fixed tasks · medium reasoning
                </span>
              </div>
              <div className="chart-panel">
                <div className="chart-toolbar">
                  <div className="metric-tabs" aria-label="Chart metric">
                    {(["changes", "score", "latency"] as const).map((m) => (
                      <button
                        key={m}
                        aria-pressed={metric === m}
                        onClick={() => setMetric(m)}
                      >
                        {m === "changes"
                          ? "Item changes"
                          : m === "score"
                            ? "Task completion"
                            : "Latency"}
                      </button>
                    ))}
                  </div>
                  <select
                    className="mobile-metric-select"
                    aria-label="History metric"
                    value={metric}
                    onChange={(e) =>
                      setMetric(
                        e.target.value as "changes" | "score" | "latency",
                      )
                    }
                  >
                    <option value="changes">Item changes</option>
                    <option value="score">Task completion</option>
                    <option value="latency">Latency</option>
                  </select>
                  <div className="chart-controls">
                    <div className="range-tabs" aria-label="History range">
                      {[7, 30, 90].map((d) => (
                        <button
                          key={d}
                          aria-pressed={days === d}
                          onClick={() => setDays(d)}
                        >
                          {d}d
                        </button>
                      ))}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={share}
                      aria-label="Copy shareable chart link"
                    >
                      {copied ? <Check size={15} /> : <Copy size={15} />}
                    </Button>
                    <Button asChild variant="ghost" size="icon">
                      <a
                        href={`/api/export?days=${days}${model ? `&model=${model}` : ""}`}
                        aria-label="Download chart evidence"
                      >
                        <Download size={15} />
                      </a>
                    </Button>
                  </div>
                </div>
                <div className="chart-caption">
                  <span>
                    {metric === "changes"
                      ? "Tasks with changed pass/fail outcomes vs. previous run"
                      : metric === "score"
                        ? "Tasks passed (out of 10)"
                        : "Median end-to-end duration (seconds)"}
                  </span>
                  <span>
                    {metric === "changes"
                      ? `${chartRows.filter((row) => visible.some((m) => row[m] !== null)).length} comparisons`
                      : `${chartRows.length} observations`}
                  </span>
                </div>
                <div
                  className="chart-area"
                  role="img"
                  aria-label={`${metric === "changes" ? "Item outcome changes" : metric === "score" ? "Task completion" : "Latency"} history over ${days} days. ${chartHasData ? `${chartRows.length} observation${chartRows.length === 1 ? "" : "s"}.` : metric === "changes" && chartRows.length ? `${chartRows.length} observation recorded; a repeat is needed for comparison.` : "No observations available."}`}
                >
                  {chartHasData ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chartRows}
                        margin={{ top: 12, right: 32, left: -18, bottom: 8 }}
                      >
                        <CartesianGrid
                          stroke="var(--line)"
                          vertical={false}
                          strokeDasharray="3 4"
                        />
                        <XAxis
                          dataKey="time"
                          type="number"
                          domain={["dataMin", "dataMax"]}
                          padding={{ left: 8, right: 12 }}
                          tickFormatter={(v) => date(new Date(v).toISOString())}
                          tickLine={false}
                          axisLine={false}
                          minTickGap={70}
                          tick={{ fill: "var(--muted)", fontSize: 11 }}
                        />
                        <YAxis
                          domain={
                            metric === "latency"
                              ? [0, "auto"]
                              : metric === "changes"
                                ? [0, (max: number) => Math.max(2, max + 1)]
                                : [0, 10]
                          }
                          allowDecimals={metric === "latency"}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "var(--muted)", fontSize: 11 }}
                        />
                        <Tooltip
                          labelFormatter={(v) =>
                            date(new Date(Number(v)).toISOString(), true)
                          }
                          formatter={(value, name, entry) => {
                            const row = entry.payload as Record<
                              string,
                              string | number | null
                            >;
                            return [
                              metric === "changes"
                                ? `${row[`${name}_worsened`]} worsened · ${row[`${name}_improved`]} improved · ${row[`${name}_unchanged`]} unchanged`
                                : metric === "score"
                                  ? `${Number(value).toFixed(0)}/10 passed`
                                  : `${Number(value).toFixed(1)} s`,
                              MODEL_NAMES[name as Model],
                            ];
                          }}
                          contentStyle={{
                            background: "var(--panel)",
                            border: "1px solid var(--line)",
                            borderRadius: 6,
                            fontSize: 12,
                          }}
                        />
                        {visible.map((m, index) => (
                          <Line
                            key={m}
                            dataKey={m}
                            name={m}
                            stroke={MODEL_COLORS[m]}
                            strokeWidth={2}
                            dot={{
                              r: metric === "changes" ? 7 - index * 2 : 3,
                              fill: MODEL_COLORS[m],
                              stroke: "var(--panel)",
                              strokeWidth: 1,
                            }}
                            activeDot={{ r: 5 }}
                            connectNulls={false}
                            isAnimationActive={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-chart">
                      <div className="axis-labels">
                        {(metric !== "latency"
                          ? ["10", "8", "5", "2", "0"]
                          : ["—", "—", "—", "—", "—"]
                        ).map((v, i) => (
                          <span key={i}>{v}</span>
                        ))}
                      </div>
                      <div className="grid-lines">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <span key={i} />
                        ))}
                      </div>
                      <div className="empty-chart-message">
                        <span className="empty-icon">
                          <Activity size={21} />
                        </span>
                        <h3>
                          {metric === "changes" && chartRows.length
                            ? "The next run starts the comparison."
                            : "History starts with the first run."}
                        </h3>
                        <p>
                          {data.state === "connected"
                            ? metric === "changes" && chartRows.length
                              ? "One observation recorded. No change can be measured yet."
                              : "Awaiting the first completed run."
                            : "The observation feed is unavailable."}
                        </p>
                        <Link href="/about">
                          How it works <ArrowRight size={13} />
                        </Link>
                      </div>
                      <div className="empty-chart-bottom">
                        <span>{days} days ago</span>
                        <span>Today</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="chart-footer">
                  <div className="chart-legend">
                    {MODELS.map((m) => (
                      <button
                        key={m}
                        aria-pressed={visible.includes(m)}
                        className={!visible.includes(m) ? "legend-off" : ""}
                        onClick={() =>
                          setVisible((prev) =>
                            prev.includes(m)
                              ? prev.length === 1
                                ? prev
                                : prev.filter((x) => x !== m)
                              : [...prev, m],
                          )
                        }
                      >
                        <span style={{ background: MODEL_COLORS[m] }} />
                        {MODEL_NAMES[m]}
                        {metric === "changes" && typeof chartRows.at(-1)?.[m] === "number" && (
                          <> · {chartRows.at(-1)?.[m]} changed</>
                        )}
                      </button>
                    ))}
                  </div>
                  <span>
                    Fixed panel · {data.suite?.id ?? "Panel being prepared"}
                  </span>
                </div>
              </div>
              <div className="chart-footnote">
                <Info size={12} />
                <p>
                  {metric === "changes"
                    ? "Each point compares a run with the previous run. The first run has no comparison; lines appear after another repeat."
                    : metric === "score"
                      ? "Strict completion is a secondary measure. It does not capture partial progress."
                      : "Execution time is tracked separately from task outcomes."}
                </p>
              </div>
            </section>
            {model && (
              <section className="item-results-section">
                <div className="section-heading">
                  <h2>Task outcomes</h2>
                  <span className="section-note">
                    Latest result · compared within this model
                  </span>
                </div>
                <div className="item-results-table">
                  <div className="item-results-head">
                    <span>Task</span>
                    <span>Latest outcome</span>
                    <span>vs. previous run</span>
                    <span>Measured detail</span>
                  </div>
                  {data.tasks
                    .filter(
                      (t) =>
                        t.suite_id ===
                        (active!.latest?.suiteId ?? data.suite?.id),
                    )
                    .map((task) => {
                      const item = (
                        active!.partial?.items ??
                        active!.latest?.items ??
                        []
                      ).find((a) => a.task_id === task.id);
                      const change = active!.partial
                        ? undefined
                        : active!.changes?.items.find(
                            (c) => c.taskId === task.id,
                          );
                      const variability = active!.variability.find(
                        (v) => v.taskId === task.id,
                      );
                      const previous = active!.partial
                        ? undefined
                        : active!.series
                            .at(-2)
                            ?.items.find((a) => a.task_id === task.id);
                      const diagnostics = taskDiagnostics(item, previous);
                      return (
                        <div key={task.id} className="item-result-row">
                          <div>
                            <strong>{task.title}</strong>
                            <small>{task.capability}</small>
                          </div>
                          <div>
                            <span
                              className={cn(
                                "result",
                                item?.score === 1
                                  ? "pass"
                                  : item?.score === 0
                                    ? "fail"
                                    : "infra",
                              )}
                            >
                              {item?.score == null
                                ? "Unavailable"
                                : item.score === 1
                                  ? "Passed"
                                  : "Not passed"}
                            </span>
                            {variability && variability.n > 1 && (
                              <small>
                                {variability.flips} outcome flip
                                {variability.flips === 1 ? "" : "s"} /{" "}
                                {variability.n} runs
                              </small>
                            )}
                          </div>
                          <div
                            className={cn("item-direction", change?.direction)}
                          >
                            {change
                              ? change.direction === "unchanged"
                                ? "Unchanged"
                                : change.direction === "improved"
                                  ? "Improved"
                                  : "Worsened"
                              : "—"}
                          </div>
                          <div className="item-diagnostics">
                            {diagnostics.length ? (
                              diagnostics.map((d) => (
                                <span key={d.label}>
                                  {d.label}: <strong>{d.value}</strong>
                                  {d.change && (
                                    <em className="diagnostic-delta">
                                      {" "}
                                      ({d.change})
                                    </em>
                                  )}
                                </span>
                              ))
                            ) : (
                              <span>
                                {item?.score == null
                                  ? "—"
                                  : "Strict answer check"}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
                <div className="item-results-note">
                  <span>
                    Diagnostics retain each task’s own units. They are not
                    combined into an intelligence score.
                  </span>
                  <Link href="/evidence">
                    Full records <ArrowRight size={13} />
                  </Link>
                </div>
              </section>
            )}
            {data.incidents.some((i) => !model || i.model === model) && (
              <section className="home-incidents">
                <div className="section-heading">
                  <h2>Recent changes</h2>
                  <Link href="/incidents">
                    All incidents <ArrowRight size={13} />
                  </Link>
                </div>
                <IncidentList
                  data={{ ...data, incidents: data.incidents.slice(0, 2) }}
                  model={model}
                />
              </section>
            )}
          </>
        )}
        {view === "evidence" && (
          <>
            <PageHeading
              eyebrow="THE OPEN RECORD"
              title="Inspect the evidence."
              description="Responses, scores, settings, and grading records for every published observation."
            />
            <div className="evidence-tools">
              <label className="search-box">
                <Search size={16} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search models or tasks…"
                  aria-label="Search evidence"
                />
              </label>
              <select
                aria-label="Filter evidence"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All observations</option>
                {MODELS.map((m) => (
                  <option key={m} value={m}>
                    {MODEL_NAMES[m]}
                  </option>
                ))}
                <option value="infrastructure_error">
                  Infrastructure failures
                </option>
                <option value="timeout">Timeouts</option>
              </select>
              <Button asChild variant="outline">
                <a href="/api/export">
                  <Download size={14} /> Export JSON
                </a>
              </Button>
            </div>
            <div className="evidence-summary">
              <span>{shownAttempts.length} item observations</span>
              <span>Full configuration and grading records included</span>
            </div>
            {shownAttempts.length ? (
              <div className="evidence-table">
                <div className="evidence-head">
                  <span>Task / model</span>
                  <span>Outcome</span>
                  <span>Duration</span>
                  <span>Observed</span>
                </div>
                {shownAttempts.slice(0, 150).map((a) => (
                  <button
                    className="evidence-row"
                    key={a.id}
                    onClick={() => openEvidence(a)}
                  >
                    <div>
                      <strong>
                        {data.tasks.find((t) => t.id === a.task_id)?.title ??
                          a.task_id}
                      </strong>
                      <small>{MODEL_NAMES[a.model]} · medium</small>
                    </div>
                    <span
                      className={cn(
                        "result",
                        a.score === 1
                          ? "pass"
                          : a.score === null
                            ? "infra"
                            : "fail",
                      )}
                    >
                      {a.score === null
                        ? a.execution_status.replaceAll("_", " ")
                        : a.score === 1
                          ? "Passed"
                          : a.score === 0
                            ? "Not passed"
                            : score(a.score)}
                    </span>
                    <span>{duration(a.latency_ms)}</span>
                    <span>
                      {date(a.completed_at, true)} <ArrowUpRight size={13} />
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <Empty
                title={
                  search
                    ? "No matching observations"
                    : "No published observations yet"
                }
                detail={
                  search
                    ? "Try a different model or task name."
                    : "Real evaluation results will appear here after grading and publication."
                }
              />
            )}
            {shownAttempts.length > 150 && (
              <p className="footnote">
                Showing the most recent 150 matches. Download JSON for the full
                available record.
              </p>
            )}
            <details className="all-task-definitions">
              <summary className="task-definitions-toggle">
                Task definitions <ChevronDown size={15} />
              </summary>
              <div className="section-heading task-heading">
                <div>
                  <span className="section-number">01</span>
                  <h2>The fixed task panel</h2>
                </div>
                <span>{data.tasks.length} definitions</span>
              </div>
              <div className="task-list">
                {data.tasks.map((t) => (
                  <details key={t.id}>
                    <summary>
                      <span className="mono">{t.id}</span>
                      <strong>{t.title}</strong>
                      <span className="task-cap">{t.capability}</span>
                      <ChevronDown size={15} />
                    </summary>
                    <div className="task-definition">
                      <p>{t.description}</p>
                      <dl>
                        <dt>Source</dt>
                        <dd>
                          {t.source_url ? (
                            <a
                              href={t.source_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Upstream source <ExternalLink size={12} />
                            </a>
                          ) : (
                            "isModelDumber original"
                          )}
                        </dd>
                        <dt>License</dt>
                        <dd>{t.license}</dd>
                        <dt>Revision</dt>
                        <dd className="mono">{t.source_revision}</dd>
                        <dt>Grader</dt>
                        <dd>{t.grader_version}</dd>
                        <dt>Time limit</dt>
                        <dd>{t.max_seconds} seconds</dd>
                        <dt>Definition SHA-256</dt>
                        <dd className="mono hash">{t.definition_hash}</dd>
                      </dl>
                      <pre>{t.prompt}</pre>
                    </div>
                  </details>
                ))}
              </div>
            </details>
          </>
        )}
        {view === "incidents" && (
          <>
            <PageHeading
              eyebrow="THE OBSERVATION LOG"
              title="Changes worth investigating."
              description="Regressions, recoveries, and infrastructure failures. Every entry records its evidence and the limits of what it tells us."
            />
            <IncidentList data={data} />
          </>
        )}
        {view === "methodology" && <Methodology data={data} />}
      </main>
      <footer className="site-footer">
        <div className="footer-top">
          <Link className="brand" href="/">
            <Activity size={18} />
            isModel<span>Dumber</span>
          </Link>
          <span>Tracking model performance.</span>
          <a href="/api/export">
            Open data <ArrowUpRight size={13} />
          </a>
        </div>
        <div className="footer-bottom">
          <p>Independent project. Not affiliated with OpenAI.</p>
          <span>© {new Date(data.fetchedAt).getUTCFullYear()}</span>
        </div>
      </footer>
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <section
            className="evidence-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="evidence-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dialog-head">
              <div>
                <span className="eyebrow">ITEM OBSERVATION</span>
                <h2 id="evidence-title">
                  {data.tasks.find((t) => t.id === selected.task_id)?.title ??
                    selected.task_id}
                </h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                autoFocus
                onClick={() => setSelected(null)}
                aria-label="Close evidence"
              >
                <X size={19} />
              </Button>
            </div>
            <div className="dialog-body">
              <div className="evidence-facts">
                <span>{MODEL_NAMES[selected.model]} · medium</span>
                <span>{date(selected.completed_at, true)}</span>
                <span>{duration(selected.latency_ms)}</span>
                <span>Score: {score(selected.score)}</span>
              </div>
              <h3>Response</h3>
              <pre>
                {evidenceLoading
                  ? "Loading the original response…"
                  : evidenceError
                    ? "The detail request failed. Close and reopen this record to retry."
                    : (selected.response ?? "No response recorded.")}
              </pre>
              <h3>Grading record</h3>
              <pre>{JSON.stringify(selected.grading, null, 2)}</pre>
              <h3>Runtime and configuration</h3>
              <pre>
                {JSON.stringify(
                  {
                    runtimeModel: selected.runtime_model,
                    identityEvidence: selected.identity_evidence,
                    configuration: selected.configuration,
                    inputTokens: selected.input_tokens,
                    outputTokens: selected.output_tokens,
                    costUSD: selected.cost_usd,
                    error: selected.error,
                  },
                  null,
                  2,
                )}
              </pre>
              <h3>Action trace</h3>
              <pre>{JSON.stringify(selected.actions, null, 2)}</pre>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="page-heading">
      <span className="eyebrow">+ {eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  );
}
function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <FlaskConical size={20} />
      </span>
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}
function IncidentList({ data, model }: { data: Snapshot; model?: Model }) {
  const incidents = data.incidents.filter((i) => !model || i.model === model);
  return (
    <div className="incident-list">
      {incidents.length ? (
        incidents.map((i) => (
          <article key={i.id} className="incident">
            <span
              className={cn(
                "incident-marker",
                i.kind === "recovery" && "recovery",
              )}
            />
            <div>
              <div className="incident-meta">
                <span>{MODEL_NAMES[i.model]}</span>
                <time dateTime={i.created_at}>{date(i.created_at, true)}</time>
              </div>
              <h3>{i.title}</h3>
              <p>{i.description}</p>
              <details>
                <summary>View evidence</summary>
                <pre>{JSON.stringify(i.evidence, null, 2)}</pre>
              </details>
            </div>
          </article>
        ))
      ) : (
        <div className="quiet-log">
          <span className="incident-marker neutral" />
          <div>
            <span className="eyebrow">NO INCIDENTS RECORDED</span>
            <h3>
              {data.attempts.length
                ? "No noteworthy changes logged."
                : "Observation begins with the first run."}
            </h3>
            <p>
              {data.attempts.length
                ? "A quiet log is not proof that performance is unchanged."
                : "Regressions and recoveries will appear here when comparable observations support them."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
function Methodology({ data }: { data: Snapshot }) {
  return (
    <div className="about-page">
      <PageHeading
        eyebrow="ABOUT THE PROJECT"
        title="Is the model changing?"
        description="isModelDumber tracks how three Codex models perform on the same ten tasks over time."
      />
      <div className="about-copy">
        <section>
          <h2>What we measure</h2>
          <p>
            We run GPT-6.1 Terra, GPT-6 Luna, and GPT-6.1 Sol as native Codex
            subagents, all at medium reasoning. Each model gets a fresh context
            for each task. The panel includes abstract puzzles, programming,
            mathematics, and a real interactive environment.
          </p>
        </section>
        <section>
          <h2>How it works</h2>
          <p>
            Each manually triggered run contains 30 attempts: ten tasks per
            model. Deterministic graders check the answers and code, and
            interactive actions are replayed independently. The first panel
            stays fixed for 21 days
            {data.suite ? `, through ${date(data.suite.frozen_until)}` : ""}.
          </p>
          <p>
            We compare each model with its own history. Six complete runs
            establish the initial baseline; three more are needed before
            flagging a persistent decline. A flag is a reason to investigate,
            not a claim of statistical significance.
          </p>
        </section>
        <section>
          <h2>What the numbers can tell us</h2>
          <p>
            Ten tasks give a limited view. They can expose changes in specific
            behaviours, but they cannot measure general intelligence. Repeated
            answers are correlated, and a single bad result may be ordinary
            variation. We show outcome changes within each model and retain
            task-specific diagnostics where available. Completion counts are a
            secondary measure; latency and execution errors remain separate.
          </p>
        </section>
        <div className="about-links">
          <a href="https://github.com/veerdosi/is-model-dumber/tree/main/docs">
            Technical protocol <ArrowUpRight size={14} />
          </a>
          <Link href="/evidence">
            Evaluation records <ArrowRight size={14} />
          </Link>
          <a href="/api/export">
            Download data <Download size={14} />
          </a>
        </div>
        <p className="about-independent">
          An independent project. Not affiliated with OpenAI.
        </p>
      </div>
    </div>
  );
}
