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

/**
 * `GET /api/team/[id]` — team metadata plus every member's usage for `?month=`.
 * Members are identified by account id; sync keys are never returned.
 */
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

    const month = queryParam(req, "month") ?? new Date().toISOString().slice(0, 7);

    // One row per member (account); their usage is summed over every active
    // sync key, and the budget comes from the account (falling back to the
    // pre-account value on the key rows).
    const memberRows = await query<TeamMemberUsageRow>`
      SELECT
        tm.account_id AS id,
        tm.display_name AS name,
        tm.joined_at,
        MAX(u.month) AS month,
        SUM(u.aiu) AS aiu,
        SUM(u.input_tokens) AS input_tokens,
        SUM(u.output_tokens) AS output_tokens,
        COALESCE(MAX(ab.budget), MAX(u.budget)) AS budget,
        (ARRAY_AGG(u.script_version ORDER BY u.updated_at DESC))[1] AS script_version,
        MAX(u.updated_at) AS updated_at
      FROM team_members tm
      LEFT JOIN sync_keys k ON k.account_id = tm.account_id AND k.disabled_at IS NULL
      LEFT JOIN usage u ON u.user_uuid = k.key AND u.month = ${month}
      LEFT JOIN account_budgets ab ON ab.account_id = tm.account_id AND ab.month = ${month}
      WHERE tm.team_id = ${id}
      GROUP BY tm.account_id, tm.display_name, tm.joined_at
      ORDER BY tm.joined_at ASC
    `;

    const members: TeamMember[] = memberRows.map((m) => ({
      id: m.id,
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
