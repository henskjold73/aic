import type { VercelRequest, VercelResponse } from "@vercel/node";
import { int, iso, num, query, sql, type UsageRow } from "../../db";
import { applyCors, errorMessage, fail, isUuid, parseBody, queryParam } from "../../http";
import type { UsagePatchBody, UsagePostBody, UsageRecord } from "../../../src/types";

/**
 * `/api/usage/[uuid]`
 *
 * - `GET`   — the current month's usage record
 * - `POST`  — upsert a full usage record (written by the sync script)
 * - `PATCH` — update individual fields, currently only `budget` (written by the browser)
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (applyCors(req, res, ["GET", "POST", "PATCH"])) return;

  const uuid = queryParam(req, "uuid");
  if (!isUuid(uuid)) return fail(res, 400, "invalid uuid");

  const currentMonth = new Date().toISOString().slice(0, 7);

  if (req.method === "POST") {
    const body = parseBody<UsagePostBody>(req);
    if (!body) return fail(res, 400, "invalid body");

    const {
      month = currentMonth,
      aiu,
      input_tokens,
      output_tokens,
      script_version = null,
    } = body;

    try {
      await sql`
        INSERT INTO usage (user_uuid, month, aiu, input_tokens, output_tokens, script_version, updated_at)
        VALUES (${uuid}, ${month}, ${aiu}, ${input_tokens}, ${output_tokens}, ${script_version}, NOW())
        ON CONFLICT (user_uuid, month) DO UPDATE SET
          aiu = EXCLUDED.aiu,
          input_tokens = EXCLUDED.input_tokens,
          output_tokens = EXCLUDED.output_tokens,
          script_version = EXCLUDED.script_version,
          updated_at = NOW()
      `;
      res.status(200).json({ ok: true });
    } catch (err: unknown) {
      fail(res, 500, errorMessage(err));
    }
    return;
  }

  if (req.method === "PATCH") {
    const patch = parseBody<UsagePatchBody>(req);
    if (!patch) return fail(res, 400, "invalid body");

    try {
      if (patch.budget != null) {
        await sql`
          INSERT INTO usage (user_uuid, month, budget)
          VALUES (${uuid}, ${currentMonth}, ${patch.budget})
          ON CONFLICT (user_uuid, month) DO UPDATE SET
            budget = EXCLUDED.budget
        `;
      }
      res.status(200).json({ ok: true });
    } catch (err: unknown) {
      fail(res, 500, errorMessage(err));
    }
    return;
  }

  if (req.method === "GET") {
    try {
      const rows = await query<UsageRow>`
        SELECT * FROM usage
        WHERE user_uuid = ${uuid} AND month = ${currentMonth}
        LIMIT 1
      `;

      const row = rows[0];
      if (!row) return fail(res, 404, "not found");

      const record: UsageRecord = {
        month: row.month,
        aiu: num(row.aiu) ?? 0,
        input_tokens: int(row.input_tokens) ?? 0,
        output_tokens: int(row.output_tokens) ?? 0,
        budget: num(row.budget),
        script_version: row.script_version,
        updated_at: iso(row.updated_at) ?? new Date().toISOString(),
      };
      res.status(200).json(record);
    } catch (err: unknown) {
      fail(res, 500, errorMessage(err));
    }
    return;
  }

  fail(res, 405, "method not allowed");
}
