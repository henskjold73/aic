import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  int,
  iso,
  num,
  query,
  type TeamMemberUsageRow,
  type TeamRow,
} from "../../db";
import { applyCors, errorMessage, fail, isUuid, queryParam } from "../../http";
import type { Team, TeamMember } from "../../../src/types";

/** `GET /api/team/[id]` — team metadata plus every member's current-month usage. */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (applyCors(req, res, ["GET"])) return;
  if (req.method !== "GET") return fail(res, 405, "method not allowed");

  const id = queryParam(req, "id");
  if (!isUuid(id)) return fail(res, 400, "invalid id");

  try {
    const teamRows = await query<TeamRow>`
      SELECT * FROM teams WHERE id = ${id} LIMIT 1
    `;
    const team = teamRows[0];
    if (!team) return fail(res, 404, "team not found");

    const currentMonth = new Date().toISOString().slice(0, 7);

    const memberRows = await query<TeamMemberUsageRow>`
      SELECT
        tm.user_uuid AS uuid,
        tm.display_name AS name,
        tm.joined_at,
        u.month,
        u.aiu,
        u.input_tokens,
        u.output_tokens,
        u.budget,
        u.script_version,
        u.updated_at
      FROM team_members tm
      LEFT JOIN usage u
        ON u.user_uuid = tm.user_uuid AND u.month = ${currentMonth}
      WHERE tm.team_id = ${id}
      ORDER BY tm.joined_at ASC
    `;

    const members: TeamMember[] = memberRows.map((m) => ({
      uuid: m.uuid,
      name: m.name,
      joined_at: iso(m.joined_at) ?? "",
      usage: m.month
        ? {
            month: m.month,
            aiu: num(m.aiu) ?? 0,
            input_tokens: int(m.input_tokens) ?? 0,
            output_tokens: int(m.output_tokens) ?? 0,
            budget: num(m.budget),
            script_version: m.script_version,
            updated_at: iso(m.updated_at) ?? "",
          }
        : null,
    }));

    const payload: Team = {
      id: team.id,
      name: team.name,
      created_at: iso(team.created_at) ?? "",
      members,
    };
    res.status(200).json(payload);
  } catch (err: unknown) {
    fail(res, 500, errorMessage(err));
  }
}
