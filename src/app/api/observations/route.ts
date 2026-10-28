import { getSnapshot } from "@/lib/data";
export const dynamic = "force-dynamic";
export async function GET() {
  const data = await getSnapshot();
  return Response.json(data, {
    status: data.state === "unavailable" ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
