const { sql, ensureSchema } = require('../../db');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/team/[id]/join
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const { id } = req.query;
  if (!id || !UUID_RE.test(id)) return res.status(400).json({ error: 'invalid team id' });

  try {
    await ensureSchema();

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { uuid, name } = body || {};

    if (!uuid || !UUID_RE.test(uuid)) return res.status(400).json({ error: 'invalid uuid' });
    if (!name || !name.trim()) return res.status(400).json({ error: 'name required' });

    const teamRows = await sql`
      SELECT name FROM teams WHERE id = ${id} LIMIT 1
    `;
    if (!teamRows.length) return res.status(404).json({ error: 'team not found' });

    await sql`
      INSERT INTO team_members (user_uuid, team_id, display_name)
      VALUES (${uuid}, ${id}, ${name.trim().slice(0, 32)})
      ON CONFLICT (user_uuid, team_id) DO UPDATE SET
        display_name = EXCLUDED.display_name
    `;

    return res.status(200).json({ ok: true, team_name: teamRows[0].name });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
