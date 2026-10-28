import { Dashboard } from "@/components/dashboard";
import { getSnapshot } from "@/lib/data";
export const dynamic = "force-dynamic";
export const metadata = { title: "Incidents" };
export default async function Page() {
  return <Dashboard initial={await getSnapshot()} view="incidents" />;
}
