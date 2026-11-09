import type { VercelRequest, VercelResponse } from "@vercel/node";
import { legacyKeyApiEnabled, sql } from "../../db";
import { accountIdForKey } from "../../_accounts";
import { sessionAccountId } from "../../_auth";
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
  if (!body) return fail(res, 400, "invalid body");
  if (body.uuid !== undefined && !isUuid(body.uuid)) return fail(res, 400, "invalid uuid");

  let accountId: string | null = null;
  if (body.uuid === undefined) {
    accountId = sessionAccountId(req);
    if (!accountId) return fail(res, 401, "not signed in");
  } else if (!legacyKeyApiEnabled()) {
    return fail(res, 403, "sign in to leave a team");
  }

  try {
    if (accountId === null && body.uuid !== undefined) accountId = await accountIdForKey(body.uuid);
    if (accountId !== null) {
      await sql`DELETE FROM team_members WHERE account_id = ${accountId} AND team_id = ${id}`;
    }
    const ok: ApiOk = { ok: true };
    res.status(200).json(ok);
  } catch (err: unknown) {
    fail(res, 500, errorMessage(err));
  }
}
