import { neon } from "@neondatabase/serverless";

const connectionString: string | undefined =
  process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL (or POSTGRES_URL) is not set");
}

/**
 * Raw Neon tagged-template query function. Prefer {@link query}, which lets you
 * declare the row shape you expect.
 */
export const sql = neon(connectionString);

/** Any row returned by Postgres before column-level narrowing. */
export type DbRow = Record<string, unknown>;

/**
 * Tagged-template query with a caller-supplied row type.
 *
 * @example
 * const rows = await query<UsageRow>`SELECT * FROM usage WHERE user_uuid = ${uuid}`;
 */
export async function query<T extends DbRow = DbRow>(
  strings: TemplateStringsArray,
  ...params: unknown[]
): Promise<T[]> {
  const rows = await sql(strings, ...params);
  return rows as T[];
}

// ── Row shapes ────────────────────────────────────────────────────
//
// Postgres returns NUMERIC and BIGINT columns as strings over the wire, and
// TIMESTAMPTZ as either a string or a Date depending on the driver's type
// parsers. The row types below reflect that; use the coercion helpers to
// normalise before serialising to JSON.

/** A value that Postgres may hand back as either a number or a numeric string. */
export type PgNumeric = string | number | null;

/** A value that Postgres may hand back as either an ISO string or a Date. */
export type PgTimestamp = string | Date | null;

export interface TeamRow extends DbRow {
  id: string;
  name: string;
  created_at: PgTimestamp;
}

export interface TeamMemberRow extends DbRow {
  user_uuid: string;
  team_id: string;
  display_name: string;
  joined_at: PgTimestamp;
}

export interface UsageRow extends DbRow {
  user_uuid: string;
  month: string;
  aiu: PgNumeric;
  input_tokens: PgNumeric;
  output_tokens: PgNumeric;
  budget: PgNumeric;
  script_version: string | null;
  updated_at: PgTimestamp;
}

export interface UsageDailyRow extends DbRow {
  user_uuid: string;
  date: PgTimestamp;
  aiu: PgNumeric;
  input_tokens: PgNumeric;
  output_tokens: PgNumeric;
  project: string | null;
  synced_at: PgTimestamp;
}

/** Joined shape returned by the team detail query. */
export interface TeamMemberUsageRow extends DbRow {
  uuid: string;
  name: string;
  joined_at: PgTimestamp;
  month: string | null;
  aiu: PgNumeric;
  input_tokens: PgNumeric;
  output_tokens: PgNumeric;
  budget: PgNumeric;
  script_version: string | null;
  updated_at: PgTimestamp;
}

// ── Coercion helpers ──────────────────────────────────────────────

/** Coerce a Postgres NUMERIC to a float, or `null` when absent/unparseable. */
export function num(value: PgNumeric | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isNaN(n) ? null : n;
}

/** Coerce a Postgres BIGINT to an integer, or `null` when absent/unparseable. */
export function int(value: PgNumeric | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number.parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

/** Coerce a Postgres TIMESTAMPTZ/DATE to an ISO-8601 string. */
export function iso(value: PgTimestamp | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : value;
}

/** Coerce a Postgres DATE to a `YYYY-MM-DD` string. */
export function dateKey(value: PgTimestamp | undefined): string | null {
  const s = iso(value);
  return s === null ? null : s.slice(0, 10);
}

let schemaReady = false;

/** Create the application tables if they do not already exist. Idempotent. */
export async function ensureSchema(): Promise<void> {
  if (schemaReady) return;

  await sql`
    CREATE TABLE IF NOT EXISTS teams (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS team_members (
      user_uuid UUID NOT NULL,
      team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      display_name TEXT NOT NULL,
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_uuid, team_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS usage (
      user_uuid UUID NOT NULL,
      month TEXT NOT NULL,
      aiu NUMERIC(14, 4),
      input_tokens BIGINT,
      output_tokens BIGINT,
      budget NUMERIC(14, 4),
      script_version TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_uuid, month)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS usage_daily (
      user_uuid UUID NOT NULL,
      date DATE NOT NULL,
      aiu NUMERIC(14, 4),
      input_tokens BIGINT,
      output_tokens BIGINT,
      project TEXT,
      synced_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_uuid, date)
    )
  `;

  schemaReady = true;
}
