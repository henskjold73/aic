import { createHash, randomInt } from "node:crypto";
import { num, query, sql, type DbRow, type PgNumeric } from "./db";
import type { AccountWarning } from "../src/types";

/** Account-level operations shared by the `/api/me` handler and the ping route. */

// ── Attaching keys ────────────────────────────────────────────────

export type AttachResult = "attached" | "already" | "merged" | "taken";

/**
 * Attach a sync key to an account. A key with no row yet is attached as new; a
 * key that only belongs to a hidden shadow account is moved over (its budgets
 * come with it); a key owned by another real account is refused.
 */
export async function attachKeyToAccount(accountId: string, key: string): Promise<AttachResult> {
  const rows = await query<{ account_id: string; shadow: boolean }>`
    SELECT k.account_id, a.shadow
    FROM sync_keys k JOIN accounts a ON a.id = k.account_id
    WHERE k.key = ${key} LIMIT 1
  `;
  const existing = rows[0];

  if (!existing) {
    await sql`INSERT INTO sync_keys (key, account_id) VALUES (${key}, ${accountId}) ON CONFLICT (key) DO NOTHING`;
    return "attached";
  }
  if (existing.account_id === accountId) return "already";
  if (!existing.shadow) return "taken";

  const shadowId = existing.account_id;
  await sql.transaction([
    sql`
      INSERT INTO account_budgets (account_id, month, budget)
      SELECT ${accountId}, month, budget FROM account_budgets WHERE account_id = ${shadowId}
      ON CONFLICT (account_id, month) DO NOTHING
    `,
    // Memberships follow the person: drop the shadow's row where the account is
    // already in that team, move the rest, before the shadow account is deleted
    // (its rows would otherwise cascade away).
    sql`
      DELETE FROM team_members
      WHERE account_id = ${shadowId}
        AND team_id IN (SELECT team_id FROM team_members WHERE account_id = ${accountId})
    `,
    sql`UPDATE team_members SET account_id = ${accountId} WHERE account_id = ${shadowId}`,
    sql`UPDATE sync_keys SET account_id = ${accountId} WHERE key = ${key}`,
    sql`
      DELETE FROM accounts
      WHERE id = ${shadowId} AND shadow
        AND NOT EXISTS (SELECT 1 FROM sync_keys WHERE account_id = ${shadowId})
    `,
  ]);
  return "merged";
}

/** The account a sync key belongs to, or `null` for a key we have never seen. */
export async function accountIdForKey(key: string): Promise<string | null> {
  const rows = await query<{ account_id: string }>`
    SELECT account_id FROM sync_keys WHERE key = ${key} LIMIT 1
  `;
  return rows[0]?.account_id ?? null;
}

// ── Pairing codes ─────────────────────────────────────────────────

/** No 0/O/1/I/L so a code read off a terminal is hard to mistype. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;
const CODE_TTL_MINUTES = 15;
const MAX_FAILED_ATTEMPTS = 10;
const ATTEMPT_WINDOW_MINUTES = 10;

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** Uppercase and strip separators so `abcd-efgh` and `ABCDEFGH` match. */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Display form `XXXX-XXXX`. */
function formatCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * Issue a pairing code for a key, replacing any earlier one. Returns `null`
 * when the key already belongs to a real (non-shadow) account — nothing to pair.
 */
export async function createPairingCode(
  key: string,
): Promise<{ code: string } | { linked: true }> {
  const owner = await query<{ shadow: boolean }>`
    SELECT a.shadow FROM sync_keys k JOIN accounts a ON a.id = k.account_id
    WHERE k.key = ${key} LIMIT 1
  `;
  if (owner[0] && !owner[0].shadow) return { linked: true };

  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];

  await sql.transaction([
    sql`DELETE FROM pairing_codes WHERE key = ${key}`,
    sql`
      INSERT INTO pairing_codes (code_hash, key, expires_at)
      VALUES (${hashCode(code)}, ${key}, NOW() + (${CODE_TTL_MINUTES} || ' minutes')::interval)
    `,
  ]);
  return { code: formatCode(code) };
}

export type RedeemResult =
  | { status: "ok"; result: AttachResult }
  | { status: "invalid" }
  | { status: "throttled" };

/**
 * Redeem a pairing code for the signed-in account. Wrong guesses are counted
 * per account and refused once too many accumulate.
 */
export async function redeemPairingCode(accountId: string, input: string): Promise<RedeemResult> {
  const failures = await query<{ n: PgNumeric }>`
    SELECT COUNT(*) AS n FROM pairing_attempts
    WHERE account_id = ${accountId}
      AND at > NOW() - (${ATTEMPT_WINDOW_MINUTES} || ' minutes')::interval
  `;
  if ((num(failures[0]?.n) ?? 0) >= MAX_FAILED_ATTEMPTS) return { status: "throttled" };

  const code = normalizeCode(input);
  const rows =
    code.length === CODE_LENGTH
      ? await query<{ key: string }>`
          SELECT key FROM pairing_codes
          WHERE code_hash = ${hashCode(code)} AND expires_at > NOW() LIMIT 1
        `
      : [];
  const found = rows[0];
  if (!found) {
    await sql`INSERT INTO pairing_attempts (account_id) VALUES (${accountId})`;
    return { status: "invalid" };
  }

  const result = await attachKeyToAccount(accountId, found.key);
  if (result !== "taken") await sql`DELETE FROM pairing_codes WHERE key = ${found.key}`;
  return { status: "ok", result };
}

// ── Duplicate detection ───────────────────────────────────────────

interface ActiveKey extends DbRow {
  id: string;
  key: string;
  db_fingerprint: string | null;
  aiu_month: PgNumeric;
}

interface OverlapRow extends DbRow {
  key_a: string;
  key_b: string;
}

interface DismissalRow extends DbRow {
  key_id_a: string;
  key_id_b: string;
  signature: string;
}

/** Order-independent pair identity. */
function pairOf(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** Fingerprints in key-id order, so it is the same whichever way round the pair is given. */
function signatureOf(a: ActiveKey, b: ActiveKey): string {
  const fp = (k: ActiveKey): string => k.db_fingerprint ?? "";
  return a.id < b.id ? `${fp(a)}|${fp(b)}` : `${fp(b)}|${fp(a)}`;
}

/** Closed days with identical non-zero totals needed before we say "likely". */
const MIN_MATCHING_DAYS = 2;

/**
 * Find pairs of the account's active keys that probably read the same Copilot
 * data and so double-count usage. Pairs the user has dismissed (and whose
 * fingerprints have not changed since) are left out.
 */
export async function computeWarnings(accountId: string, month: string): Promise<AccountWarning[]> {
  const keys = await query<ActiveKey>`
    SELECT k.id, k.key, k.db_fingerprint, COALESCE(u.aiu, 0) AS aiu_month
    FROM sync_keys k
    LEFT JOIN usage u ON u.user_uuid = k.key AND u.month = ${month}
    WHERE k.account_id = ${accountId} AND k.disabled_at IS NULL
  `;
  if (keys.length < 2) return [];

  const byKey = new Map(keys.map((k) => [k.key, k]));
  const found = new Map<string, { a: ActiveKey; b: ActiveKey; reason: AccountWarning["reason"] }>();

  // Certain: same database fingerprint.
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = keys[i];
      const b = keys[j];
      if (a && b && a.db_fingerprint && a.db_fingerprint === b.db_fingerprint) {
        found.set(pairOf(a.id, b.id).join("|"), { a, b, reason: "same_database" });
      }
    }
  }

  // Likely: identical daily totals on several closed days. Skipped when both
  // keys report fingerprints and those differ — that is positive evidence of
  // different machines.
  const overlaps = await query<OverlapRow>`
    SELECT x.user_uuid AS key_a, y.user_uuid AS key_b
    FROM usage_daily x
    JOIN usage_daily y
      ON y.date = x.date
      AND x.user_uuid < y.user_uuid
      AND y.aiu = x.aiu
      AND y.input_tokens = x.input_tokens
      AND y.output_tokens = x.output_tokens
    JOIN sync_keys kx ON kx.key = x.user_uuid
    JOIN sync_keys ky ON ky.key = y.user_uuid
    WHERE kx.account_id = ${accountId} AND ky.account_id = ${accountId}
      AND kx.disabled_at IS NULL AND ky.disabled_at IS NULL
      AND x.aiu > 0
      AND x.date < CURRENT_DATE
    GROUP BY x.user_uuid, y.user_uuid
    HAVING COUNT(*) >= ${MIN_MATCHING_DAYS}
  `;
  for (const row of overlaps) {
    const a = byKey.get(row.key_a);
    const b = byKey.get(row.key_b);
    if (!a || !b) continue;
    if (a.db_fingerprint && b.db_fingerprint && a.db_fingerprint !== b.db_fingerprint) continue;
    const id = pairOf(a.id, b.id).join("|");
    if (!found.has(id)) found.set(id, { a, b, reason: "matching_days" });
  }
  if (found.size === 0) return [];

  const dismissals = await query<DismissalRow>`
    SELECT key_id_a, key_id_b, signature FROM duplicate_dismissals WHERE account_id = ${accountId}
  `;
  const dismissed = new Map(dismissals.map((d) => [`${d.key_id_a}|${d.key_id_b}`, d.signature]));

  const warnings: AccountWarning[] = [];
  for (const [id, { a, b, reason }] of found) {
    if (dismissed.get(id) === signatureOf(a, b)) continue;
    const [first, second] = pairOf(a.id, b.id);
    warnings.push({
      kind: "duplicate_keys",
      key_ids: [first, second],
      reason,
      overstated_aiu: Math.min(num(a.aiu_month) ?? 0, num(b.aiu_month) ?? 0),
      month,
    });
  }
  return warnings;
}

/** Record that the user says these two keys are different machines. */
export async function dismissWarning(
  accountId: string,
  idA: string,
  idB: string,
): Promise<boolean> {
  const [first, second] = pairOf(idA, idB);
  const rows = await query<ActiveKey>`
    SELECT id, key, db_fingerprint, 0 AS aiu_month FROM sync_keys
    WHERE account_id = ${accountId} AND id IN (${first}, ${second})
  `;
  const a = rows.find((r) => r.id === first);
  const b = rows.find((r) => r.id === second);
  if (!a || !b) return false;

  await sql`
    INSERT INTO duplicate_dismissals (account_id, key_id_a, key_id_b, signature)
    VALUES (${accountId}, ${first}, ${second}, ${signatureOf(a, b)})
    ON CONFLICT (account_id, key_id_a, key_id_b) DO UPDATE SET
      signature = EXCLUDED.signature, dismissed_at = NOW()
  `;
  return true;
}
