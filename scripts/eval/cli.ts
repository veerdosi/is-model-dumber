import nextEnv from "@next/env";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  existsSync,
  renameSync,
  unlinkSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { homedir } from "node:os";
import { randomUUID, createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { MODELS, type Attempt, type Run } from "../../src/lib/types";
import { summarize } from "../../src/lib/monitor";
nextEnv.loadEnvConfig(process.cwd());
const root = process.cwd(),
  runsRoot = join(root, ".runs");
mkdirSync(runsRoot, { recursive: true });
const manifest = JSON.parse(
  readFileSync("benchmarks/panel-v1/manifest.json", "utf8"),
);
const command = process.argv[2];
const runArg = process.argv.find((a) => a.startsWith("--run="))?.slice(6);
const currentPath = join(runsRoot, "current.json");
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
function save(path: string, v: unknown) {
  const tmp = path + ".tmp";
  writeFileSync(tmp, JSON.stringify(v, null, 2) + "\n", { mode: 0o600 });
  renameSync(tmp, path);
}
function db() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY)
    throw new Error("Supabase server credentials missing");
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
function load() {
  const id =
    runArg ??
    (existsSync(currentPath)
      ? JSON.parse(readFileSync(currentPath, "utf8")).id
      : null);
  if (!id) throw new Error("No prepared run. Run eval:prepare first.");
  return {
    dir: join(runsRoot, id),
    plan: JSON.parse(readFileSync(join(runsRoot, id, "plan.json"), "utf8")),
  };
}
function checkManifest() {
  const { manifest_hash, ...rest } = manifest;
  if (hash(JSON.stringify(sortObject(rest))) !== manifest_hash)
    throw new Error("Panel hash mismatch: frozen material was modified.");
}
function sortObject(v: any): any {
  return Array.isArray(v)
    ? v.map(sortObject)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, sortObject(v[k])]),
        )
      : v;
}
function* walk(dir: string): Generator<string> {
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, f.name);
    if (f.isDirectory()) yield* walk(path);
    else if (f.name.endsWith(".jsonl")) yield path;
  }
}
function collect(agentName: string, since: string) {
  // Read only native runtime session metadata/events for this run's exact fresh agent path.
  const base = process.env.CODEX_HOME ?? join(homedir(), ".codex");
  const sessions = join(base, "sessions");
  const dates = new Set(
    [-1, 0, 1].map((offset) =>
      new Date(Date.parse(since) + offset * 86400000)
        .toISOString()
        .slice(0, 10),
    ),
  );
  const paths = [...dates].flatMap((day) => [
    ...walk(join(sessions, ...day.split("-"))),
  ]);
  let record: any = null;
  for (const path of paths) {
    const lines = readFileSync(path, "utf8").split("\n");
    let meta: any;
    try {
      meta = JSON.parse(lines[0]).payload;
    } catch {
      continue;
    }
    if (
      meta.agent_path !== `/root/${agentName}` &&
      !String(meta.agent_path ?? "").endsWith("/" + agentName)
    )
      continue;
    if (Date.parse(meta.timestamp) < Date.parse(since) - 5000) continue;
    const contexts: any[] = [],
      actions: any[] = [];
    let final = "",
      usage: any = null,
      finishedAt = "",
      startedAt = meta.timestamp;
    for (const line of lines) {
      if (!line) continue;
      let event: any;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      const p = event.payload;
      if (event.type === "turn_context") contexts.push(p);
      if (
        event.type === "response_item" &&
        p?.type === "message" &&
        p?.role === "assistant" &&
        (p?.channel === "final" || p?.phase === "final_answer")
      ) {
        final = (p.content ?? []).map((c: any) => c.text ?? "").join("");
        finishedAt = event.timestamp;
      }
      if (
        event.type === "response_item" &&
        (p?.type === "function_call" || p?.type === "custom_tool_call")
      )
        actions.push({
          timestamp: event.timestamp,
          name: p.name,
          arguments: p.arguments ?? p.input,
        });
      if (event.type === "event_msg" && p?.type === "token_count")
        usage = p.info?.total_token_usage ?? usage;
    }
    record = {
      sessionId: meta.id,
      startedAt,
      finishedAt,
      contexts: contexts.map((c) => ({
        model: c.model,
        effort: c.effort,
        cwd: c.cwd,
      })),
      final,
      usage,
      actions,
    };
  }
  return record;
}
if (command === "seed") {
  checkManifest();
  const { plan } = load();
  const client = db();
  const prior = await client
    .from("suites")
    .select("manifest_hash")
    .eq("id", manifest.id);
  if (prior.error) throw prior.error;
  if (
    prior.data?.[0]?.manifest_hash &&
    prior.data[0].manifest_hash !== manifest.manifest_hash
  )
    throw new Error("Immutable suite mismatch");
  if (!prior.data?.length) {
    const r = await client
      .from("suites")
      .insert({
        id: manifest.id,
        title: manifest.title,
        manifest_hash: manifest.manifest_hash,
        frozen_at: plan.freeze.frozenAt,
        frozen_until: plan.freeze.frozenUntil,
        protocol: manifest.protocol,
      });
    if (r.error) throw r.error;
  }
  const r = await client.from("tasks").upsert(manifest.tasks);
  if (r.error) throw r.error;
  console.log(
    "Published 10 immutable task definitions; no observation rows created.",
  );
} else if (command === "prepare") {
  checkManifest();
  const key =
    process.argv.find((a) => a.startsWith("--key="))?.slice(6) ??
    new Date().toISOString();
  const ledgerPath = join(runsRoot, "keys.json");
  const ledger = existsSync(ledgerPath)
    ? JSON.parse(readFileSync(ledgerPath, "utf8"))
    : {};
  if (ledger[key]) {
    console.log("Existing idempotent run", ledger[key]);
    save(currentPath, { id: ledger[key] });
    process.exit(0);
  }
  const freezePath = join(runsRoot, "freeze.json");
  const now = new Date().toISOString();
  const freeze = existsSync(freezePath)
    ? JSON.parse(readFileSync(freezePath, "utf8"))
    : {
        manifestHash: manifest.manifest_hash,
        frozenAt: now,
        frozenUntil: new Date(Date.now() + 21 * 86400000).toISOString(),
      };
  if (freeze.manifestHash !== manifest.manifest_hash)
    throw new Error("Frozen panel changed; refuse to run");
  save(freezePath, freeze);
  const id = randomUUID(),
    dir = join(runsRoot, id);
  mkdirSync(dir, { recursive: true });
  const jobs = MODELS.flatMap((model) =>
    manifest.tasks.map((task: any) => {
      const agent = `eval_${id.slice(0, 8)}_${model.split("-").at(-1)}_${task.id.slice(0, 2)}`;
      const workdir = join(dir, "jobs", model, task.id);
      mkdirSync(workdir, { recursive: true });
      const prompt = `You are one independent measurement agent in isModelDumber. Solve only this task. The assigned model is ${model}, reasoning medium; do not change either. Work independently. No subagents. Time budget ${task.max_seconds} seconds from spawn. Do not inspect the project, private graders, other agents, previous runs, or external solutions. Use only this prompt and task-local scratch files. No network or browser tools, except this job's assigned ARC3 local broker if supplied. No skills or account apps. Your final response must be exactly the JSON contract requested below. Tool use is recorded. Stop within the budget; if incomplete, return your best valid answer.\n\n${task.prompt}`;
      writeFileSync(join(workdir, "prompt.txt"), prompt);
      return {
        agent,
        model,
        taskId: task.id,
        workdir,
        promptPath: join(workdir, "prompt.txt"),
        status: "pending",
      };
    }),
  );
  const plan = {
    id,
    key,
    suiteId: manifest.id,
    manifestHash: manifest.manifest_hash,
    startedAt: now,
    freeze,
    jobs,
    configuration: {
      execution: "native-codex-subagents",
      model_reasoning_effort: "medium",
      max_concurrency: 15,
      attempts_per_item: 1,
      timeout_seconds: 480,
    },
    environment: {
      platform: process.platform,
      architecture: process.arch,
      node: process.version,
      gitRevision: (() => {
        try {
          return execFileSync("git", ["rev-parse", "HEAD"], {
            encoding: "utf8",
          }).trim();
        } catch {
          return "uncommitted";
        }
      })(),
      codexVersion: process.env.CODEX_VERSION ?? null,
      dockerImage: existsSync("benchmarks/python-image.txt")
        ? readFileSync("benchmarks/python-image.txt", "utf8").trim()
        : null,
    },
  };
  save(join(dir, "plan.json"), plan);
  save(currentPath, { id });
  ledger[key] = id;
  save(ledgerPath, ledger);
  console.log(
    JSON.stringify(
      {
        runId: id,
        jobs: jobs.map(({ agent, model, taskId, promptPath }: any) => ({
          agent,
          model,
          taskId,
          promptPath,
        })),
        instructions:
          "Spawn fresh native agents with fork_turns=none and explicit model + reasoning_effort=medium. Each reads only promptPath. Collect from native session logs; never self-attest model identity.",
      },
      null,
      2,
    ),
  );
} else if (command === "broker") {
  const { plan, dir } = load();
  const model = process.argv[3];
  const job = plan.jobs.find(
    (j: any) => j.model === model && j.taskId === "03-arc3",
  );
  if (!job) throw new Error("Unknown model");
  const child = spawn(
    join(root, ".venv/bin/python"),
    ["scripts/eval/arc3_broker.py", job.workdir],
    { cwd: root, detached: true, stdio: "ignore" },
  );
  child.unref();
  console.log("Started job-specific ARC3 broker for", model, "pid", child.pid);
} else if (
  command === "status" ||
  command === "collect" ||
  command === "grade"
) {
  const { dir, plan } = load();
  const attempts: Attempt[] = [];
  for (const job of plan.jobs) {
    const responsePath = join(job.workdir, "response.txt"),
      attemptPath = join(job.workdir, "attempt.json");
    if (existsSync(attemptPath)) {
      attempts.push(JSON.parse(readFileSync(attemptPath, "utf8")));
      job.status = "graded";
      continue;
    }
    const record = collect(job.agent, plan.startedAt);
    if (!record) {
      job.status = "pending";
      continue;
    }
    job.status = record.final ? "completed" : "running";
    const expired =
      !record.final && Date.now() - Date.parse(record.startedAt) > 480000;
    if (command === "status" || (!record.final && !expired)) continue;
    if (expired) {
      record.finishedAt = new Date(
        Date.parse(record.startedAt) + 480000,
      ).toISOString();
      record.final = "";
    }
    const valid =
      record.contexts.length > 0 &&
      record.contexts.every(
        (c: any) => c.model === job.model && c.effort === "medium",
      );
    writeFileSync(responsePath, record.final, { mode: 0o600 });
    save(join(job.workdir, "runtime-evidence.json"), record);
    const latency =
      Date.parse(record.finishedAt) - Date.parse(record.startedAt);
    let grading: any;
    if (expired)
      grading = {
        infrastructure_error:
          "Observed native session did not return a final response within 480 seconds.",
      };
    else if (!valid)
      grading = {
        infrastructure_error:
          "Requested model/medium reasoning could not be verified from native runtime turn_context.",
      };
    else if (latency > 480000 && job.taskId !== "03-arc3")
      grading = {
        infrastructure_error:
          "Native execution exceeded the fixed wall-clock budget.",
      };
    else if (command === "grade") {
      try {
        grading = JSON.parse(
          execFileSync(
            join(root, ".venv/bin/python"),
            ["scripts/eval/grade.py", job.taskId, responsePath, job.workdir],
            {
              encoding: "utf8",
              timeout: 60000,
              stdio: ["ignore", "pipe", "pipe"],
            },
          )
            .trim()
            .split("\n")
            .at(-1)!,
        );
      } catch (e: any) {
        try {
          grading = JSON.parse(e.stdout?.trim().split("\n").at(-1));
        } catch {
          grading = { infrastructure_error: "Trusted grader failed" };
        }
      }
    } else continue;
    const a: any = {
      id: randomUUID(),
      run_id: plan.id,
      task_id: job.taskId,
      model: job.model,
      runtime_model: valid ? job.model : null,
      reasoning_effort: "medium",
      attempt_number: 1,
      identity_evidence: {
        source: "native Codex runtime turn_context",
        session_id: record.sessionId,
        contexts: record.contexts,
        verified: valid,
      },
      configuration: {
        ...plan.configuration,
        manifest_hash: plan.manifestHash,
        agent_path: `/root/${job.agent}`,
        tool_isolation:
          "protocol-enforced task workspace; not adversarial filesystem isolation",
      },
      started_at: record.startedAt,
      completed_at: record.finishedAt,
      latency_ms: latency,
      execution_status: grading.infrastructure_error
        ? expired || latency > 480000
          ? "timeout"
          : "infrastructure_error"
        : "success",
      score: grading.infrastructure_error ? null : grading.score,
      response: record.final,
      response_hash: hash(record.final),
      actions: [
        ...record.actions.map((action: any) => ({
          ...action,
          arguments:
            typeof action.arguments === "string"
              ? action.arguments
                  .replace(/Bearer [A-Za-z0-9_\-]{20,}/g, "Bearer <job-token>")
                  .replaceAll(root, "$WORKSPACE")
              : action.arguments,
        })),
        ...(job.taskId === "03-arc3" &&
        existsSync(join(job.workdir, "arc3-result.json"))
          ? [
              {
                name: "official_arc3_action_trace",
                actions: JSON.parse(
                  readFileSync(join(job.workdir, "arc3-result.json"), "utf8"),
                ).actions,
              },
            ]
          : []),
      ],
      grading,
      error: grading.infrastructure_error
        ? { message: grading.infrastructure_error }
        : null,
      input_tokens: record.usage?.input_tokens ?? null,
      output_tokens: record.usage?.output_tokens ?? null,
      cached_tokens: record.usage?.cached_input_tokens ?? null,
      cost_usd: null,
    };
    save(attemptPath, a);
    attempts.push(a);
    job.status = "graded";
  }
  save(join(dir, "plan.json"), plan);
  console.log(
    JSON.stringify(
      {
        runId: plan.id,
        pending: plan.jobs
          .filter((j: any) => j.status === "pending")
          .map((j: any) => j.agent),
        running: plan.jobs
          .filter((j: any) => j.status === "running")
          .map((j: any) => j.agent),
        completed: plan.jobs.filter((j: any) => j.status === "completed")
          .length,
        graded: attempts.length,
        models: MODELS.map((model) => ({
          model,
          scored: attempts.filter((a) => a.model === model && a.score !== null)
            .length,
          passed: attempts.filter((a) => a.model === model && a.score === 1)
            .length,
          infrastructureFailures: attempts.filter(
            (a) => a.model === model && a.score === null,
          ).length,
        })),
      },
      null,
      2,
    ),
  );
} else if (command === "publish") {
  checkManifest();
  const { dir, plan } = load();
  const attempts = plan.jobs.map((j: any) => {
    const path = join(j.workdir, "attempt.json");
    if (!existsSync(path))
      throw new Error(`Ungraded job ${j.agent}. No partial score publication.`);
    return JSON.parse(readFileSync(path, "utf8"));
  });
  if (
    attempts.length !== 30 ||
    new Set(attempts.map((a: any) => `${a.model}:${a.task_id}`)).size !== 30
  )
    throw new Error("Expected 30 independent unique jobs");
  const client = db();
  const must = async (p: PromiseLike<any>) => {
    const r = await p;
    if (r.error) throw new Error(`Supabase write failed: ${r.error.message}`);
    return r.data;
  };
  const existing = await must(
    client
      .from("suites")
      .select("manifest_hash,frozen_at,frozen_until")
      .eq("id", manifest.id),
  );
  if (existing.length && existing[0].manifest_hash !== manifest.manifest_hash)
    throw new Error("Published suite hash differs. Refuse history rewrite.");
  if (!existing.length)
    await must(
      client
        .from("suites")
        .insert({
          id: manifest.id,
          title: manifest.title,
          manifest_hash: manifest.manifest_hash,
          frozen_at: plan.freeze.frozenAt,
          frozen_until: plan.freeze.frozenUntil,
          protocol: manifest.protocol,
        }),
    );
  await must(client.from("tasks").upsert(manifest.tasks));
  const complete = attempts.every((a: any) => a.score !== null);
  const run: any = {
    id: plan.id,
    idempotency_key: plan.key,
    suite_id: manifest.id,
    started_at: plan.startedAt,
    completed_at: attempts
      .map((a: any) => a.completed_at)
      .sort()
      .at(-1),
    status: complete ? "complete" : "partial",
    configuration: plan.configuration,
    environment: plan.environment,
  };
  // Stage everything privately. Public visibility flips with a single final row update.
  const already = await must(
    client.from("runs").select("published").eq("id", run.id),
  );
  if (already[0]?.published) {
    console.log(
      "Run already published; leaving immutable evidence unchanged.",
      run.id,
    );
    process.exit(0);
  }
  await must(client.from("runs").upsert({ ...run, published: false }));
  await must(
    client
      .from("attempts")
      .upsert(attempts, { onConflict: "run_id,task_id,model,attempt_number" }),
  );
  const historyRuns = await must(
    client.from("runs").select("*").eq("published", true),
  );
  const history = await must(client.from("attempts").select("*").limit(20000));
  const incidents: any[] = [];
  for (const model of MODELS) {
    const summary = summarize(
      model,
      [...history.filter((a: any) => a.run_id !== run.id), ...attempts],
      [...historyRuns, run],
    );
    if (["possible_regression", "recovery"].includes(summary.status))
      incidents.push({
        id: `${run.id}:${model}:${summary.status}`,
        model,
        run_id: run.id,
        kind: summary.status,
        title:
          summary.status === "possible_regression"
            ? "Persistent decline on the fixed panel"
            : "Return toward baseline observed",
        description:
          "An exploratory within-model signal. Repeated fixed items and serial dependence limit inference; no automatic statistical significance claim.",
        evidence: {
          baseline: summary.baselineMean,
          latest: summary.latest?.score,
          paired_losses: summary.pairedLosses,
          paired_gains: summary.pairedGains,
          exploratory_p_value: summary.pValue,
          run_ids: summary.series.map((p) => p.runId),
        },
      });
    const errors = attempts.filter(
      (a: any) => a.model === model && a.score === null,
    );
    if (errors.length)
      incidents.push({
        id: `${run.id}:${model}:infrastructure`,
        model,
        run_id: run.id,
        kind: "infrastructure",
        title: `${errors.length} task observations unavailable`,
        description:
          "Execution or infrastructure failures are excluded from accuracy. This is not evidence of a capability regression.",
        evidence: { attempt_ids: errors.map((a: any) => a.id) },
      });
  }
  if (incidents.length) await must(client.from("incidents").upsert(incidents));
  await must(client.from("runs").update({ published: true }).eq("id", run.id));
  console.log(
    JSON.stringify(
      {
        published: run.id,
        status: run.status,
        results: MODELS.map((model) => ({
          model,
          passed: attempts.filter(
            (a: any) => a.model === model && a.score === 1,
          ).length,
          scored: attempts.filter(
            (a: any) => a.model === model && a.score !== null,
          ).length,
          inputTokens: attempts
            .filter((a: any) => a.model === model)
            .reduce((s: number, a: any) => s + (a.input_tokens ?? 0), 0),
          outputTokens: attempts
            .filter((a: any) => a.model === model)
            .reduce((s: number, a: any) => s + (a.output_tokens ?? 0), 0),
        })),
        costUSD: null,
        costNote:
          "Native subscription usage; billed per-run monetary cost is not exposed.",
      },
      null,
      2,
    ),
  );
} else
  throw new Error(
    "Use prepare | broker MODEL | status | collect | grade | publish [--run=UUID]",
  );
