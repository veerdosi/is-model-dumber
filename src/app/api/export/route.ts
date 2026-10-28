import { getSnapshot } from "@/lib/data";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const data = await getSnapshot(true);
  if (data.state !== "connected")
    return Response.json({ error: "Data source unavailable" }, { status: 503 });
  const params = new URL(request.url).searchParams;
  const model = params.get("model");
  const days = Number(params.get("days") ?? 90);
  const cutoff =
    Date.now() -
    (Number.isFinite(days) ? Math.max(1, Math.min(90, days)) : 90) * 86400000;
  const rows = data.attempts.filter(
    (a) =>
      (!model || a.model === model) && Date.parse(a.completed_at) >= cutoff,
  );
  return Response.json(
    {
      scope: "Native Codex subagent evaluations",
      exportedAt: data.fetchedAt,
      attempts: rows,
      runs: data.runs,
      tasks: data.tasks,
      suite: data.suite,
    },
    {
      headers: {
        "Content-Disposition":
          'attachment; filename="ismodeldumber-evidence.json"',
        "Cache-Control": "no-store",
      },
    },
  );
}
