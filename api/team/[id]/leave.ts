import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../../db";
import { applyCors, errorMessage, fail, isUuid, parseBody, queryParam } from "../../http";
import type { ApiOk, TeamLeaveBody } from "../../../src/types";

/** `POST /api/team/[id]/leave` — remove a member from a team. */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (applyCors(req, res, ["POST"])) return;
  if (req.method !== "POST") return fail(res, 405, "method not allowed");

  const id = queryParam(req, "id");
  if (!isUuid(id)) return fail(res, 400, "invalid team id");

  const body = parseBody<TeamLeaveBody>(req);
  if (!body || !isUuid(body.uuid)) return fail(res, 400, "invalid uuid");

  try {
    await sql`
      DELETE FROM team_members WHERE user_uuid = ${body.uuid} AND team_id = ${id}
    `;
    const ok: ApiOk = { ok: true };
    res.status(200).json(ok);
  } catch (err: unknown) {
    fail(res, 500, errorMessage(err));
  }
}
