import type { VercelRequest, VercelResponse } from "@vercel/node";
import { dateKey, num, query, type DbRow, type PgNumeric, type PgTimestamp } from "../../db";
import { applyCors, errorMessage, fail, isUuid, queryParam } from "../../http";
import type { TeamDaysResponse } from "../../../src/types";

interface TeamDailyRow extends DbRow {
  date: PgTimestamp;
  aiu: PgNumeric;
}

/**
 * `GET /api/team/[id]/days?month=[&member=]` — daily AIU summed across every
 * member of a team, or for a single member of it.
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (applyCors(req, res, ["GET"])) return;
  if (req.method !== "GET") return fail(res, 405, "method not allowed");

  const id = queryParam(req, "id");
  if (!isUuid(id)) return fail(res, 400, "invalid team id");

  const month = queryParam(req, "month") ?? new Date().toISOString().slice(0, 7);
  const member = queryParam(req, "member");
  if (member !== undefined && !isUuid(member)) return fail(res, 400, "invalid member id");

  try {
    // Without `member`: every member's days summed. With it: that member's own
    // days — only if they belong to this team, so a team link can never be
    // used to read an arbitrary account.
    const rows = await query<TeamDailyRow>`
      SELECT ud.date, SUM(ud.aiu) AS aiu
      FROM usage_daily ud
      JOIN sync_keys k ON k.key = ud.user_uuid AND k.disabled_at IS NULL
      JOIN team_members tm ON tm.account_id = k.account_id
      WHERE tm.team_id = ${id}
        AND (${member ?? null}::uuid IS NULL OR tm.account_id = ${member ?? null}::uuid)
        AND TO_CHAR(ud.date, 'YYYY-MM') = ${month}
      GROUP BY ud.date
      ORDER BY ud.date ASC
    `;
    if (member !== undefined && rows.length === 0) {
      const exists = await query<{ n: PgNumeric }>`
        SELECT COUNT(*) AS n FROM team_members WHERE team_id = ${id} AND account_id = ${member}
      `;
      if ((num(exists[0]?.n) ?? 0) === 0) return fail(res, 404, "member not found");
    }

    const points: TeamDaysResponse = rows.map((row) => ({
      date: dateKey(row.date) ?? "",
      aiu: num(row.aiu) ?? 0,
    }));
    res.status(200).json(points);
  } catch (err: unknown) {
    fail(res, 500, errorMessage(err));
  }
}
