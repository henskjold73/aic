import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ensureSchema, iso, query, sql, type SyncMetaRow } from "../../db";
import { applyCors, errorMessage, fail, isUuid, parseBody, queryParam } from "../../http";
import type { SyncPingPostBody, SyncPingResponse } from "../../../src/types";

/**
 * `/api/usage/[uuid]/ping`
 *
 * - `POST` — record the script version (called by the sync script on startup,
 *             before any DB work, so a broken script still registers its version)
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
    if (!body?.script_version) return fail(res, 400, "missing script_version");

    try {
      await sql`
        INSERT INTO sync_meta (user_uuid, script_version, last_ping_at)
        VALUES (${uuid}, ${body.script_version}, NOW())
        ON CONFLICT (user_uuid) DO UPDATE SET
          script_version = EXCLUDED.script_version,
          last_ping_at = NOW()
      `;
      res.status(200).json({ ok: true });
    } catch (err: unknown) {
      fail(res, 500, errorMessage(err));
    }
    return;
  }

  if (req.method === "GET") {
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
