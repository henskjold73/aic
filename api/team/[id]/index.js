const { sql, ensureSchema } = require('../../db');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });

  const { id } = req.query;
  if (!id || !UUID_RE.test(id)) return res.status(400).json({ error: 'invalid id' });

  try {
    await ensureSchema();

    const { rows: teamRows } = await sql`
      SELECT * FROM teams WHERE id = ${id} LIMIT 1
    `;
    if (!teamRows.length) return res.status(404).json({ error: 'team not found' });
    const team = teamRows[0];

    const currentMonth = new Date().toISOString().slice(0, 7);

    const { rows: members } = await sql`
      SELECT
        tm.user_uuid AS uuid,
        tm.display_name AS name,
        tm.joined_at,
        u.month,
        u.aiu,
        u.input_tokens,
        u.output_tokens,
        u.budget,
        u.script_version,
        u.updated_at
      FROM team_members tm
      LEFT JOIN usage u
        ON u.user_uuid = tm.user_uuid AND u.month = ${currentMonth}
      WHERE tm.team_id = ${id}
      ORDER BY tm.joined_at ASC
    `;

    return res.status(200).json({
      id: team.id,
      name: team.name,
      created_at: team.created_at,
      members: members.map(m => ({
        uuid: m.uuid,
        name: m.name,
        joined_at: m.joined_at,
        usage: m.month ? {
          month: m.month,
          aiu: parseFloat(m.aiu),
          input_tokens: parseInt(m.input_tokens),
          output_tokens: parseInt(m.output_tokens),
          budget: m.budget != null ? parseFloat(m.budget) : null,
          script_version: m.script_version,
          updated_at: m.updated_at,
        } : null,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
