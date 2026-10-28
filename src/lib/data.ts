import { createClient } from "@supabase/supabase-js";
import type { Snapshot, Attempt } from "./types";
export function publicDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          cache: "no-store",
          signal: AbortSignal.timeout(10000),
        }),
    },
  });
}
const summaryFields =
  "id,run_id,task_id,model,runtime_model,reasoning_effort,completed_at,started_at,latency_ms,execution_status,score,response_hash,input_tokens,output_tokens,cost_usd";
export async function getSnapshot(fullEvidence = false): Promise<Snapshot> {
  const base: Snapshot = {
    state: "unconfigured",
    fetchedAt: new Date().toISOString(),
    tasks: [],
    runs: [],
    attempts: [],
    incidents: [],
    suite: null,
  };
  const db = publicDb();
  if (!db) return base;
  try {
    const since = new Date(Date.now() - 91 * 86400000).toISOString();
    const [tasks, runs, incidents, suites] = await Promise.all([
      db.from("tasks").select("*").order("id"),
      db
        .from("runs")
        .select("*")
        .gte("started_at", since)
        .order("started_at", { ascending: false })
        .limit(200),
      db
        .from("incidents")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(100),
      db
        .from("suites")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
    if ([tasks, runs, incidents, suites].some((r) => r.error))
      return { ...base, state: "unavailable" };
    const suite = suites.data?.[0] ?? null;
    // Always retain the original six baseline runs, even after the visible 90-day window moves.
    const first = await db
      .from("runs")
      .select("*")
      .eq("suite_id", suite?.id ?? "")
      .eq("status", "complete")
      .order("started_at")
      .limit(6);
    if (first.error) return { ...base, state: "unavailable" };
    const mergedRuns = [
      ...new Map(
        [...(runs.data ?? []), ...(first.data ?? [])].map((r) => [r.id, r]),
      ).values(),
    ].sort((a, b) => b.started_at.localeCompare(a.started_at));
    const ids = mergedRuns.map((r) => r.id);
    let attempts: Attempt[] = [];
    if (ids.length) {
      for (let from = 0; from < 7000; from += 1000) {
        const page = await db
          .from("attempts")
          .select(fullEvidence ? "*" : summaryFields)
          .in("run_id", ids)
          .order("completed_at", { ascending: false })
          .order("id")
          .range(from, from + 999);
        if (page.error) return { ...base, state: "unavailable" };
        attempts.push(
          ...((page.data ?? []).map((a) => ({
            response: null,
            actions: [],
            configuration: {},
            identity_evidence: {},
            grading: {},
            error: null,
            ...(a as unknown as Record<string, unknown>),
          })) as unknown as Attempt[]),
        );
        if ((page.data?.length ?? 0) < 1000) break;
      }
    }
    return {
      ...base,
      state: "connected",
      tasks: tasks.data ?? [],
      runs: mergedRuns,
      attempts,
      incidents: incidents.data ?? [],
      suite,
    };
  } catch {
    return { ...base, state: "unavailable" };
  }
}
export async function getAttempt(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = publicDb();
  if (!db) return null;
  const r = await db.from("attempts").select("*").eq("id", id).single();
  return r.error ? null : (r.data as Attempt);
}
