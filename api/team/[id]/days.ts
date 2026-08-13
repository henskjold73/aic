import type { VercelRequest, VercelResponse } from "@vercel/node";
import { dateKey, num, query, type DbRow, type PgNumeric, type PgTimestamp } from "../../db";
import { applyCors, errorMessage, fail, isUuid, queryParam } from "../../http";
import type { TeamDaysResponse } from "../../../src/types";

interface TeamDailyRow extends DbRow {
  date: PgTimestamp;
  aiu: PgNumeric;
}

/** `GET /api/team/[id]/days` — daily AIU summed across every member of a team. */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (applyCors(req, res, ["GET"])) return;
  if (req.method !== "GET") return fail(res, 405, "method not allowed");

  const id = queryParam(req, "id");
  if (!isUuid(id)) return fail(res, 400, "invalid team id");

  const month = queryParam(req, "month") ?? new Date().toISOString().slice(0, 7);

  try {
    const rows = await query<TeamDailyRow>`
      SELECT ud.date, SUM(ud.aiu) AS aiu
      FROM usage_daily ud
      JOIN team_members tm ON tm.user_uuid = ud.user_uuid
      WHERE tm.team_id = ${id}
        AND TO_CHAR(ud.date, 'YYYY-MM') = ${month}
      GROUP BY ud.date
      ORDER BY ud.date ASC
    `;

    const points: TeamDaysResponse = rows.map((row) => ({
      date: dateKey(row.date) ?? "",
      aiu: num(row.aiu) ?? 0,
    }));
    res.status(200).json(points);
  } catch (err: unknown) {
    fail(res, 500, errorMessage(err));
  }
}
