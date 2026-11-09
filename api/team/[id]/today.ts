import type { VercelRequest, VercelResponse } from "@vercel/node";
import { num, query, type DbRow, type PgNumeric } from "../../db";
import { applyCors, errorMessage, fail, isUuid, queryParam } from "../../http";
import type { TeamTodayResponse } from "../../../src/types";

interface TeamTodayRow extends DbRow {
  id: string;
  name: string;
  aiu_today: PgNumeric;
}

/** `GET /api/team/[id]/today` — per-member AIU for today, sorted highest first. */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (applyCors(req, res, ["GET"])) return;
  if (req.method !== "GET") return fail(res, 405, "method not allowed");

  const id = queryParam(req, "id");
  if (!isUuid(id)) return fail(res, 400, "invalid team id");

  try {
    const rows = await query<TeamTodayRow>`
      SELECT
        tm.account_id AS id,
        tm.display_name AS name,
        COALESCE(SUM(ud.aiu), 0) AS aiu_today
      FROM team_members tm
      LEFT JOIN sync_keys k ON k.account_id = tm.account_id AND k.disabled_at IS NULL
      LEFT JOIN usage_daily ud ON ud.user_uuid = k.key AND ud.date = CURRENT_DATE
      WHERE tm.team_id = ${id}
      GROUP BY tm.account_id, tm.display_name
      ORDER BY aiu_today DESC
    `;

    const payload: TeamTodayResponse = rows.map((row) => ({
      id: row.id,
      name: row.name,
      aiu_today: num(row.aiu_today) ?? 0,
    }));
    res.status(200).json(payload);
  } catch (err: unknown) {
    fail(res, 500, errorMessage(err));
  }
}
