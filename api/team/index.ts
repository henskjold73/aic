import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomUUID } from "node:crypto";
import { sql } from "../db";
import { applyCors, errorMessage, fail, parseBody } from "../http";
import type { TeamCreateBody, TeamCreateResponse } from "../../src/types";

const MAX_TEAM_NAME_LENGTH = 64;

/** `POST /api/team` — create a new team and return its id and name. */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (applyCors(req, res, ["POST"])) return;
  if (req.method !== "POST") return fail(res, 405, "method not allowed");

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
