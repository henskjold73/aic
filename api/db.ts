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
  /** Public, safe-to-return member handle: the member's account id. */
  account_id: string;
  /** Legacy: a sync key the member joined with. Never returned by an API. */
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

export interface SyncMetaRow extends DbRow {
  user_uuid: string;
  script_version: string;
  last_ping_at: PgTimestamp;
}

export interface AccountRow extends DbRow {
  id: string;
  github_id: PgNumeric;
  display_name: string | null;
  /** True for accounts auto-created for a pre-account sync key; nobody has logged in to it yet. */
  shadow: boolean;
  created_at: PgTimestamp;
}

/**
 * A sync key: the write-only secret held by one machine's sync script.
 * `key` is the legacy `user_uuid` and must never be returned by a public API.
 */
export interface SyncKeyRow extends DbRow {
  /** Public handle, safe to return from APIs. */
  id: string;
  key: string;
  account_id: string;
  label: string | null;
  db_fingerprint: string | null;
  created_at: PgTimestamp;
  last_ping_at: PgTimestamp;
  disabled_at: PgTimestamp;
}

export interface AccountBudgetRow extends DbRow {
  account_id: string;
  month: string;
  budget: PgNumeric;
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
  /** The member's account id. */
  id: string;
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

/** The account's non-disabled sync keys, oldest first. */
export async function activeKeys(accountId: string): Promise<string[]> {
  const rows = await query<{ key: string }>`
    SELECT key FROM sync_keys
    WHERE account_id = ${accountId} AND disabled_at IS NULL
    ORDER BY created_at ASC
  `;
  return rows.map((r) => r.key);
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
    CREATE TABLE IF NOT EXISTS sync_meta (
      user_uuid UUID PRIMARY KEY,
      script_version TEXT NOT NULL,
      last_ping_at TIMESTAMPTZ DEFAULT NOW()
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

  await sql`
    CREATE TABLE IF NOT EXISTS accounts (
      id UUID PRIMARY KEY,
      github_id BIGINT UNIQUE,
      display_name TEXT,
      shadow BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // `key` is the legacy usage.user_uuid. No FK from usage/usage_daily/team_members
  // yet: phase 1 keeps the existing write path untouched.
  await sql`
    CREATE TABLE IF NOT EXISTS sync_keys (
      key UUID PRIMARY KEY,
      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      label TEXT,
      db_fingerprint TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_ping_at TIMESTAMPTZ,
      disabled_at TIMESTAMPTZ
    )
  `;
  // `id` is the public handle for a key (used by the Devices UI); `key` stays secret.
  await sql`ALTER TABLE sync_keys ADD COLUMN IF NOT EXISTS id UUID NOT NULL DEFAULT gen_random_uuid()`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS sync_keys_id_idx ON sync_keys (id)`;
  await sql`CREATE INDEX IF NOT EXISTS sync_keys_account_idx ON sync_keys (account_id)`;
  await sql`CREATE INDEX IF NOT EXISTS sync_keys_fingerprint_idx ON sync_keys (db_fingerprint)`;

  await sql`
    CREATE TABLE IF NOT EXISTS account_budgets (
      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      month TEXT NOT NULL,
      budget NUMERIC(14, 4),
      PRIMARY KEY (account_id, month)
    )
  `;

  // One-time pairing codes: a freshly installed machine shows a code, the user
  // enters it while signed in, and the key moves onto their account.
  await sql`
    CREATE TABLE IF NOT EXISTS pairing_codes (
      code_hash TEXT PRIMARY KEY,
      key UUID NOT NULL REFERENCES sync_keys(key) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS pairing_codes_key_idx ON pairing_codes (key)`;

  // Failed redemptions per account, for throttling code guessing.
  await sql`
    CREATE TABLE IF NOT EXISTS pairing_attempts (
      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS pairing_attempts_account_idx ON pairing_attempts (account_id, at)`;

  // "These are different machines" — valid only while both keys' fingerprints
  // still match `signature`, so a changed machine re-raises the warning.
  await sql`
    CREATE TABLE IF NOT EXISTS duplicate_dismissals (
      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      key_id_a UUID NOT NULL,
      key_id_b UUID NOT NULL,
      signature TEXT NOT NULL,
      dismissed_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (account_id, key_id_a, key_id_b)
    )
  `;

  await backfillShadowAccounts();
  await migrateTeamMembers();

  schemaReady = true;
}

/**
 * Give every sync key that already exists in the legacy tables a shadow
 * account and copy its budgets across. Idempotent: keys that already have a
 * `sync_keys` row are skipped.
 */
async function backfillShadowAccounts(): Promise<void> {
  await sql`
    WITH new_keys AS (
      SELECT k AS key, gen_random_uuid() AS account_id
      FROM (
        SELECT user_uuid AS k FROM usage
        UNION SELECT user_uuid FROM usage_daily
        UNION SELECT user_uuid FROM team_members
        UNION SELECT user_uuid FROM sync_meta
      ) found
      WHERE k NOT IN (SELECT key FROM sync_keys)
    ),
    new_accounts AS (
      INSERT INTO accounts (id, shadow)
      SELECT account_id, TRUE FROM new_keys
    )
    INSERT INTO sync_keys (key, account_id)
    SELECT key, account_id FROM new_keys
    ON CONFLICT (key) DO NOTHING
  `;

  await sql`
    INSERT INTO account_budgets (account_id, month, budget)
    SELECT k.account_id, u.month, u.budget
    FROM usage u
    JOIN sync_keys k ON k.key = u.user_uuid
    WHERE u.budget IS NOT NULL
    ON CONFLICT (account_id, month) DO NOTHING
  `;
}

/**
 * Key team membership by account instead of sync key, so a team view shows one
 * row per person (summing their machines) and never needs to expose a key.
 *
 * `user_uuid` stays populated (with a key the member joined with) so older
 * deployments can still read the table, but nothing reads it any more.
 * Idempotent.
 */
async function migrateTeamMembers(): Promise<void> {
  await sql`
    ALTER TABLE team_members
    ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE
  `;
  await sql`
    UPDATE team_members tm SET account_id = k.account_id
    FROM sync_keys k
    WHERE k.key = tm.user_uuid AND tm.account_id IS NULL
  `;
  // Two keys of one person may both have joined the same team; keep the earliest.
  await sql`
    DELETE FROM team_members a USING team_members b
    WHERE a.account_id = b.account_id AND a.team_id = b.team_id
      AND (a.joined_at > b.joined_at
           OR (a.joined_at = b.joined_at AND a.user_uuid > b.user_uuid))
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS team_members_account_team_idx
    ON team_members (account_id, team_id)
  `;
}

/**
 * Whether the pre-account, key-only API (reading usage or teams by sync key,
 * patching a budget by key) is still served. Set `LEGACY_KEY_API=off` once
 * everyone has signed in to switch it off. The script *write* routes
 * (usage/days/ping POST) are never affected.
 */
export function legacyKeyApiEnabled(): boolean {
  return process.env.LEGACY_KEY_API !== "off";
}

/**
 * Make sure a sync key has a `sync_keys` row (and a shadow account if it is
 * new). Call from every handler that a script writes through, so keys that
 * first appear after the backfill are covered too.
 *
 * A concurrent first-contact race can leave one orphan shadow account with no
 * keys; it is harmless and can be swept later.
 */
export async function ensureSyncKey(key: string): Promise<void> {
  await sql`
    WITH new_account AS (
      INSERT INTO accounts (id, shadow)
      SELECT gen_random_uuid(), TRUE
      WHERE NOT EXISTS (SELECT 1 FROM sync_keys WHERE key = ${key})
      RETURNING id
    )
    INSERT INTO sync_keys (key, account_id)
    SELECT ${key}, id FROM new_account
    ON CONFLICT (key) DO NOTHING
  `;
}
