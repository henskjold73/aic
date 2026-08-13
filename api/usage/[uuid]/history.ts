import type { VercelRequest, VercelResponse } from "@vercel/node";
import { int, iso, num, query, type UsageRow } from "../../db";
import { applyCors, errorMessage, fail, isUuid, queryParam } from "../../http";
import type { UsageHistoryRecord } from "../../../src/types";

/**
 * `GET /api/usage/[uuid]/history` — every monthly row for a user, newest first.
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (applyCors(req, res, ["GET"])) return;
  if (req.method !== "GET") return fail(res, 405, "method not allowed");

  const uuid = queryParam(req, "uuid");
  if (!isUuid(uuid)) return fail(res, 400, "invalid uuid");

  try {
    const rows = await query<UsageRow>`
      SELECT month, aiu, input_tokens, output_tokens, budget, script_version, updated_at
      FROM usage
      WHERE user_uuid = ${uuid}
      ORDER BY month DESC
    `;

    const records: UsageHistoryRecord[] = rows.map((r) => ({
      month: r.month,
      aiu: num(r.aiu),
      input_tokens: int(r.input_tokens),
      output_tokens: int(r.output_tokens),
      budget: num(r.budget),
      script_version: r.script_version,
      updated_at: iso(r.updated_at) ?? "",
    }));
    res.status(200).json(records);
  } catch (err: unknown) {
    fail(res, 500, errorMessage(err));
  }
}
