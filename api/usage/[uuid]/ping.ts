import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ensureSchema, ensureSyncKey, iso, legacyKeyApiEnabled, query, sql, type SyncMetaRow } from "../../db";
import { applyCors, errorMessage, fail, isUuid, parseBody, queryParam } from "../../http";
import { createPairingCode } from "../../_accounts";
import type { SyncPingPostBody, SyncPingPostResponse, SyncPingResponse } from "../../../src/types";

/**
 * `/api/usage/[uuid]/ping`
 *
 * - `POST` — record the script version and optional DB fingerprint, and/or hand the
 *             installer a one-time pairing code (`request_pair_code`). The sync script
 *             calls it on startup, before any DB work, so a broken script still
 *             registers its version.
 * - `GET`  — return the last-seen script version for a UUID
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (applyCors(req, res, ["GET", "POST"])) return;

  const uuid = queryParam(req, "uuid");
  if (!isUuid(uuid)) return fail(res, 400, "invalid uuid");

  await ensureSchema();

  if (req.method === "POST") {
    const body = parseBody<SyncPingPostBody>(req);
    const wantsCode = body?.request_pair_code === true;
    if (!body?.script_version && !wantsCode) return fail(res, 400, "missing script_version");

    const fingerprint =
      typeof body.db_fingerprint === "string" && /^[0-9a-f]{64}$/i.test(body.db_fingerprint)
        ? body.db_fingerprint.toLowerCase()
        : null;

    try {
      await ensureSyncKey(uuid);
      const response: SyncPingPostResponse = { ok: true };

      if (body.script_version) {
        await sql`
          UPDATE sync_keys SET
            last_ping_at = NOW(),
            db_fingerprint = COALESCE(${fingerprint}, db_fingerprint)
          WHERE key = ${uuid}
        `;
        await sql`
          INSERT INTO sync_meta (user_uuid, script_version, last_ping_at)
          VALUES (${uuid}, ${body.script_version}, NOW())
          ON CONFLICT (user_uuid) DO UPDATE SET
            script_version = EXCLUDED.script_version,
            last_ping_at = NOW()
        `;
      }

      if (wantsCode) {
        const pairing = await createPairingCode(uuid);
        if ("code" in pairing) response.pair_code = pairing.code;
        else response.linked = true;
      }
      res.status(200).json(response);
    } catch (err: unknown) {
      fail(res, 500, errorMessage(err));
    }
    return;
  }

  if (req.method === "GET") {
    if (!legacyKeyApiEnabled()) return fail(res, 403, "key-only access is turned off — sign in");
    try {
      const rows = await query<SyncMetaRow>`
        SELECT * FROM sync_meta WHERE user_uuid = ${uuid} LIMIT 1
      `;
      const row = rows[0];
      if (!row) return fail(res, 404, "no ping recorded");

      const response: SyncPingResponse = {
        script_version: row.script_version,
        last_ping_at: iso(row.last_ping_at) ?? new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (err: unknown) {
      fail(res, 500, errorMessage(err));
    }
    return;
  }

  fail(res, 405, "method not allowed");
}
