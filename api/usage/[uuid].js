const { sql, ensureSchema } = require('../db');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { uuid } = req.query;

  if (!uuid || !UUID_RE.test(uuid)) {
    return res.status(400).json({ error: 'invalid uuid' });
  }

  await ensureSchema();

  const currentMonth = new Date().toISOString().slice(0, 7);

  // POST — upsert full usage record for current month
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { month = currentMonth, aiu, input_tokens, output_tokens, script_version } = body;

      await sql`
        INSERT INTO usage (user_uuid, month, aiu, input_tokens, output_tokens, script_version, updated_at)
        VALUES (${uuid}, ${month}, ${aiu}, ${input_tokens}, ${output_tokens}, ${script_version}, NOW())
        ON CONFLICT (user_uuid, month) DO UPDATE SET
          aiu = EXCLUDED.aiu,
          input_tokens = EXCLUDED.input_tokens,
          output_tokens = EXCLUDED.output_tokens,
          script_version = EXCLUDED.script_version,
          updated_at = NOW()
      `;

      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // PATCH — update specific fields (e.g. budget from browser)
  if (req.method === 'PATCH') {
    try {
      const patch = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      if (patch.budget != null) {
        await sql`
          INSERT INTO usage (user_uuid, month, budget)
          VALUES (${uuid}, ${currentMonth}, ${patch.budget})
          ON CONFLICT (user_uuid, month) DO UPDATE SET
            budget = EXCLUDED.budget
        `;
      }

      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // GET — return current month's usage
  if (req.method === 'GET') {
    try {
      const { rows } = await sql`
        SELECT * FROM usage
        WHERE user_uuid = ${uuid} AND month = ${currentMonth}
        LIMIT 1
      `;

      if (!rows.length) return res.status(404).json({ error: 'not found' });

      const row = rows[0];
      return res.status(200).json({
        month: row.month,
        aiu: parseFloat(row.aiu),
        input_tokens: parseInt(row.input_tokens),
        output_tokens: parseInt(row.output_tokens),
        budget: row.budget != null ? parseFloat(row.budget) : null,
        script_version: row.script_version,
        updated_at: row.updated_at,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'method not allowed' });
};
