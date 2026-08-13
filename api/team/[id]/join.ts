import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query, sql, type TeamRow } from "../../db";
import { applyCors, errorMessage, fail, isUuid, parseBody, queryParam } from "../../http";
import type { TeamJoinBody, TeamJoinResponse } from "../../../src/types";

const MAX_DISPLAY_NAME_LENGTH = 32;

/** `POST /api/team/[id]/join` — add or rename a member in a team. */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (applyCors(req, res, ["POST"])) return;
  if (req.method !== "POST") return fail(res, 405, "method not allowed");

  const id = queryParam(req, "id");
  if (!isUuid(id)) return fail(res, 400, "invalid team id");

  const body = parseBody<TeamJoinBody>(req);
  if (!body) return fail(res, 400, "invalid body");
  if (!isUuid(body.uuid)) return fail(res, 400, "invalid uuid");

  const displayName = body.name?.trim();
  if (!displayName) return fail(res, 400, "name required");

  try {
    const teamRows = await query<TeamRow>`
      SELECT name FROM teams WHERE id = ${id} LIMIT 1
    `;
    const team = teamRows[0];
    if (!team) return fail(res, 404, "team not found");

    await sql`
      INSERT INTO team_members (user_uuid, team_id, display_name)
      VALUES (${body.uuid}, ${id}, ${displayName.slice(0, MAX_DISPLAY_NAME_LENGTH)})
      ON CONFLICT (user_uuid, team_id) DO UPDATE SET
        display_name = EXCLUDED.display_name
    `;

    const joined: TeamJoinResponse = { ok: true, team_name: team.name };
    res.status(200).json(joined);
  } catch (err: unknown) {
    fail(res, 500, errorMessage(err));
  }
}
