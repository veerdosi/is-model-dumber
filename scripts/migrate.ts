import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
import { readFileSync, readdirSync } from "node:fs";
loadEnvConfig(process.cwd());
const files = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .sort();
if (process.env.DATABASE_URL) {
  const { default: postgres } = await import("postgres");
  const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" });
  await sql`create table if not exists public.ismd_migrations (name text primary key, applied_at timestamptz default now())`;
  for (const file of files) {
    if (
      (await sql`select name from public.ismd_migrations where name=${file}`)
        .length
    )
      continue;
    await sql.unsafe(readFileSync(`supabase/migrations/${file}`, "utf8"));
    await sql`insert into public.ismd_migrations(name) values(${file})`;
    console.log("Applied", file);
  }
  await sql.end();
} else if (
  process.env.SUPABASE_ACCESS_TOKEN &&
  process.env.SUPABASE_PROJECT_REF
) {
  for (const file of files) {
    const r = await fetch(
      `https://api.supabase.com/v1/projects/${process.env.SUPABASE_PROJECT_REF}/database/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: readFileSync(`supabase/migrations/${file}`, "utf8"),
        }),
      },
    );
    if (!r.ok)
      throw new Error(
        `Migration ${file} failed (${r.status}); inspect in dashboard.`,
      );
    console.log("Applied", file);
  }
} else
  throw new Error(
    "Migrations require DATABASE_URL or SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF. The project secret cannot execute DDL.",
  );
