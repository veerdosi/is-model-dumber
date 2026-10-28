import { Dashboard } from "@/components/dashboard";
import { getSnapshot } from "@/lib/data";
export const dynamic = "force-dynamic";
export default async function Home() {
  return <Dashboard initial={await getSnapshot()} view="overview" />;
}
