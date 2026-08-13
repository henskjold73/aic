import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomUUID } from "node:crypto";
import { query, sql, type TeamRow } from "../db";
import { applyCors, errorMessage, fail, isUuid, parseBody, queryParam } from "../http";
import type { TeamCreateBody, TeamCreateResponse, TeamListResponse } from "../../src/types";

const MAX_TEAM_NAME_LENGTH = 64;

/**
 * `POST /api/team` — create a new team and return its id and name.
 * `GET /api/team?uuid=` — list every team a sync uuid belongs to.
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (applyCors(req, res, ["GET", "POST"])) return;

  if (req.method === "GET") return listMyTeams(req, res);
  if (req.method === "POST") return createTeam(req, res);
  return fail(res, 405, "method not allowed");
}

async function listMyTeams(req: VercelRequest, res: VercelResponse): Promise<void> {
  const uuid = queryParam(req, "uuid");
  if (!isUuid(uuid)) return fail(res, 400, "invalid uuid");

  try {
    const rows = await query<TeamRow>`
      SELECT t.id, t.name, t.created_at
      FROM teams t
      JOIN team_members tm ON tm.team_id = t.id
      WHERE tm.user_uuid = ${uuid}
      ORDER BY tm.joined_at ASC
    `;
    const teams: TeamListResponse = rows.map((row) => ({ id: row.id, name: row.name }));
    res.status(200).json(teams);
  } catch (err: unknown) {
    fail(res, 500, errorMessage(err));
  }
}

async function createTeam(req: VercelRequest, res: VercelResponse): Promise<void> {
  const body = parseBody<TeamCreateBody>(req);
  const name = (body?.name?.trim() || "My Team").slice(0, MAX_TEAM_NAME_LENGTH);
  const id = randomUUID();

  try {
    await sql`INSERT INTO teams (id, name) VALUES (${id}, ${name})`;
    const created: TeamCreateResponse = { id, name };
    res.status(200).json(created);
  } catch (err: unknown) {
    fail(res, 500, errorMessage(err));
  }
}
