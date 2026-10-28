export const MODELS = ["gpt-6.1-terra", "gpt-6-luna", "gpt-6.1-sol"] as const;
export type Model = (typeof MODELS)[number];
export const MODEL_NAMES: Record<Model, string> = {
  "gpt-6.1-terra": "GPT-6.1 Terra",
  "gpt-6-luna": "GPT-6 Luna",
  "gpt-6.1-sol": "GPT-6.1 Sol",
};
export const MODEL_COLORS: Record<Model, string> = {
  "gpt-6.1-terra": "#65b99b",
  "gpt-6-luna": "#d4ae69",
  "gpt-6.1-sol": "#7e9fd4",
};
export type Task = {
  id: string;
  suite_id: string;
  title: string;
  capability: string;
  description: string;
  prompt: string;
  source_url: string | null;
  source_revision: string;
  license: string;
  grader_version: string;
  max_seconds: number;
  definition_hash: string;
  metadata: Record<string, unknown>;
};
export type Run = {
  id: string;
  suite_id: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  configuration: Record<string, unknown>;
  environment: Record<string, unknown>;
};
export type Attempt = {
  id: string;
  run_id: string;
  task_id: string;
  model: Model;
  runtime_model: string | null;
  reasoning_effort: string;
  completed_at: string;
  started_at: string;
  latency_ms: number | null;
  execution_status:
    "success" | "task_error" | "infrastructure_error" | "timeout";
  score: number | null;
  response: string | null;
  response_hash: string | null;
  actions: unknown[];
  grading: Record<string, unknown>;
  configuration: Record<string, unknown>;
  identity_evidence: Record<string, unknown>;
  error: unknown;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
};
export type Incident = {
  id: string;
  model: Model;
  kind: string;
  title: string;
  description: string;
  created_at: string;
  evidence: Record<string, unknown>;
};
export type Snapshot = {
  state: "connected" | "unconfigured" | "unavailable";
  fetchedAt: string;
  tasks: Task[];
  runs: Run[];
  attempts: Attempt[];
  incidents: Incident[];
  suite: {
    id: string;
    frozen_until: string;
    protocol: Record<string, unknown>;
  } | null;
};
