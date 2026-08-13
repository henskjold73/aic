import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * `/api/admin/migrate` — retired. The blob-to-Postgres migration is complete,
 * so this endpoint only reports 410 Gone.
 */
export default async function handler(
  _req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  res.status(410).json({ message: "Migration already completed. Blob storage removed." });
}
