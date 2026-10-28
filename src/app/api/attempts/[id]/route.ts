import { getAttempt } from "@/lib/data";
export const dynamic = "force-dynamic";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await getAttempt(id);
  return Response.json(result ?? { error: "Observation not found" }, {
    status: result ? 200 : 404,
    headers: { "Cache-Control": "no-store" },
  });
}
