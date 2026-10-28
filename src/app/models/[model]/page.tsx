import { notFound } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { getSnapshot } from "@/lib/data";
import { MODELS, type Model, MODEL_NAMES } from "@/lib/types";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ model: string }>;
}) {
  const { model } = await params;
  return { title: MODEL_NAMES[model as Model] ?? "Model" };
}
export default async function ModelPage({
  params,
}: {
  params: Promise<{ model: string }>;
}) {
  const { model } = await params;
  if (!MODELS.includes(model as Model)) notFound();
  return (
    <Dashboard
      initial={await getSnapshot()}
      view="model"
      model={model as Model}
    />
  );
}
