const { list } = require('@vercel/blob');
const { sql, ensureSchema } = require('../db');

// One-time migration: reads all blobs and inserts into Postgres.
// Hit GET /api/admin/migrate?secret=<MIGRATE_SECRET> to run.
// Set MIGRATE_SECRET as an env var in Vercel to protect the endpoint.
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });

  const secret = process.env.MIGRATE_SECRET;
  if (secret && req.query.secret !== secret) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  await ensureSchema();

  const results = { teams: 0, members: 0, usage: 0, errors: [] };

  try {
    // ── Migrate teams ──────────────────────────────────────────────
    let teamCursor;
    do {
      const { blobs, cursor } = await list({ prefix: 'teams/', limit: 100, cursor: teamCursor });
      teamCursor = cursor;

      for (const blob of blobs) {
        // skip member sub-paths if any
        const match = blob.pathname.match(/^teams\/([^/]+)\.json$/);
        if (!match) continue;

        try {
          const data = await fetch(blob.url).then(r => r.json());
          if (!data.id || !data.name) continue;

          await sql`
            INSERT INTO teams (id, name, created_at)
            VALUES (${data.id}, ${data.name}, ${data.created_at ?? new Date().toISOString()})
            ON CONFLICT (id) DO NOTHING
          `;
          results.teams++;

          for (const member of data.members || []) {
            if (!member.uuid || !member.name) continue;
            await sql`
              INSERT INTO team_members (user_uuid, team_id, display_name, joined_at)
              VALUES (${member.uuid}, ${data.id}, ${member.name}, ${member.joined_at ?? new Date().toISOString()})
              ON CONFLICT (user_uuid, team_id) DO NOTHING
            `;
            results.members++;
          }
        } catch (err) {
          results.errors.push(`team ${blob.pathname}: ${err.message}`);
        }
      }
    } while (teamCursor);

    // ── Migrate usage ──────────────────────────────────────────────
    let usageCursor;
    do {
      const { blobs, cursor } = await list({ prefix: 'usage/', limit: 100, cursor: usageCursor });
      usageCursor = cursor;

      for (const blob of blobs) {
        const match = blob.pathname.match(/^usage\/([^/]+)\.json$/);
        if (!match) continue;
        const uuid = match[1];

        try {
          const data = await fetch(blob.url).then(r => r.json());
          if (!data.month) continue;

          await sql`
            INSERT INTO usage (user_uuid, month, aiu, input_tokens, output_tokens, budget, script_version, updated_at)
            VALUES (
              ${uuid},
              ${data.month},
              ${data.aiu ?? null},
              ${data.input_tokens ?? null},
              ${data.output_tokens ?? null},
              ${data.budget ?? null},
              ${data.script_version ?? null},
              ${data.updated_at ?? new Date().toISOString()}
            )
            ON CONFLICT (user_uuid, month) DO UPDATE SET
              aiu = EXCLUDED.aiu,
              input_tokens = EXCLUDED.input_tokens,
              output_tokens = EXCLUDED.output_tokens,
              budget = EXCLUDED.budget,
              script_version = EXCLUDED.script_version,
              updated_at = EXCLUDED.updated_at
          `;
          results.usage++;
        } catch (err) {
          results.errors.push(`usage ${blob.pathname}: ${err.message}`);
        }
      }
    } while (usageCursor);

    return res.status(200).json({ ok: true, ...results });
  } catch (err) {
    return res.status(500).json({ error: err.message, ...results });
  }
};
