import type { VercelRequest, VercelResponse } from "@vercel/node";
import { activeKeys, ensureSchema, ensureSyncKey, legacyKeyApiEnabled, query, sql, type TeamRow } from "../../db";
import { accountIdForKey } from "../../_accounts";
import { sessionAccountId } from "../../_auth";
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

  // Who is joining: the signed-in account, or (legacy) the owner of `body.uuid`.
  let accountId: string | null = null;
  let memberKey: string | undefined;
  if (body.uuid === undefined) {
    accountId = sessionAccountId(req);
    if (!accountId) return fail(res, 401, "not signed in");
    memberKey = (await activeKeys(accountId))[0];
    if (!memberKey) return fail(res, 400, "no sync key on this account yet");
  } else {
    if (!isUuid(body.uuid)) return fail(res, 400, "invalid uuid");
    if (!legacyKeyApiEnabled()) return fail(res, 403, "sign in to join a team");
    memberKey = body.uuid;
  }

  const displayName = body.name?.trim();
  if (!displayName) return fail(res, 400, "name required");

  try {
    await ensureSchema();
    const teamRows = await query<TeamRow>`
      SELECT name FROM teams WHERE id = ${id} LIMIT 1
    `;
    const team = teamRows[0];
    if (!team) return fail(res, 404, "team not found");

    if (accountId === null) {
      await ensureSyncKey(memberKey);
      accountId = await accountIdForKey(memberKey);
    }
    if (!accountId) return fail(res, 500, "could not resolve account");

    // `user_uuid` is kept populated for older deployments; membership is by account.
    await sql`
      INSERT INTO team_members (user_uuid, account_id, team_id, display_name)
      VALUES (${memberKey}, ${accountId}, ${id}, ${displayName.slice(0, MAX_DISPLAY_NAME_LENGTH)})
      ON CONFLICT (account_id, team_id) DO UPDATE SET
        display_name = EXCLUDED.display_name
    `;

    const joined: TeamJoinResponse = { ok: true, team_name: team.name };
    res.status(200).json(joined);
  } catch (err: unknown) {
    fail(res, 500, errorMessage(err));
  }
}
