const { sql } = require('../../db');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/usage/[uuid]/history — all monthly rows for a user
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });

  const { uuid } = req.query;
  if (!uuid || !UUID_RE.test(uuid)) return res.status(400).json({ error: 'invalid uuid' });

  try {
    const rows = await sql`
      SELECT month, aiu, input_tokens, output_tokens, budget, script_version, updated_at
      FROM usage
      WHERE user_uuid = ${uuid}
      ORDER BY month DESC
    `;

    return res.status(200).json(rows.map(r => ({
      month: r.month,
      aiu: r.aiu != null ? parseFloat(r.aiu) : null,
      input_tokens: r.input_tokens != null ? parseInt(r.input_tokens) : null,
      output_tokens: r.output_tokens != null ? parseInt(r.output_tokens) : null,
      budget: r.budget != null ? parseFloat(r.budget) : null,
      script_version: r.script_version,
      updated_at: r.updated_at,
    })));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
