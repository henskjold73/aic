import type { VercelRequest, VercelResponse } from "@vercel/node";
import { dateKey, int, iso, num, query, sql, type UsageDailyRow } from "../../db";
import { applyCors, errorMessage, fail, isUuid, parseBody, queryParam } from "../../http";
import type { DailyUsageRecord, DaysPostBody } from "../../../src/types";

/**
 * `/api/usage/[uuid]/days`
 *
 * - `GET`  — daily rows for `?month=YYYY-MM` (defaults to the current month)
 * - `POST` — upsert a batch of daily rows from the sync script
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (applyCors(req, res, ["GET", "POST"])) return;

  const uuid = queryParam(req, "uuid");
  if (!isUuid(uuid)) return fail(res, 400, "invalid uuid");

  if (req.method === "POST") {
    const body = parseBody<DaysPostBody>(req);
    const days = body?.days;
    if (!Array.isArray(days) || days.length === 0) {
      return fail(res, 400, "days array required");
    }
    const project = body?.project ?? null;

    try {
      for (const day of days) {
        await sql`
          INSERT INTO usage_daily (user_uuid, date, aiu, input_tokens, output_tokens, project, synced_at)
          VALUES (${uuid}, ${day.date}, ${day.aiu}, ${day.input_tokens}, ${day.output_tokens}, ${project}, NOW())
          ON CONFLICT (user_uuid, date) DO UPDATE SET
            aiu = EXCLUDED.aiu,
            input_tokens = EXCLUDED.input_tokens,
            output_tokens = EXCLUDED.output_tokens,
            project = COALESCE(EXCLUDED.project, usage_daily.project),
            synced_at = NOW()
        `;
      }
      res.status(200).json({ ok: true, upserted: days.length });
    } catch (err: unknown) {
      fail(res, 500, errorMessage(err));
    }
    return;
  }

  if (req.method === "GET") {
    const month = queryParam(req, "month") ?? new Date().toISOString().slice(0, 7);

    try {
      const rows = await query<UsageDailyRow>`
        SELECT date, aiu, input_tokens, output_tokens, project, synced_at
        FROM usage_daily
        WHERE user_uuid = ${uuid}
          AND TO_CHAR(date, 'YYYY-MM') = ${month}
        ORDER BY date ASC
      `;

      const records: DailyUsageRecord[] = rows.map((r) => ({
        date: dateKey(r.date) ?? "",
        aiu: num(r.aiu) ?? 0,
        input_tokens: int(r.input_tokens) ?? 0,
        output_tokens: int(r.output_tokens) ?? 0,
        project: r.project,
        synced_at: iso(r.synced_at) ?? "",
      }));
      res.status(200).json(records);
    } catch (err: unknown) {
      fail(res, 500, errorMessage(err));
    }
    return;
  }

  fail(res, 405, "method not allowed");
}
