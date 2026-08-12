const { sql, ensureSchema } = require('../../db');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { uuid } = req.query;
  if (!uuid || !UUID_RE.test(uuid)) return res.status(400).json({ error: 'invalid uuid' });

  await ensureSchema();

  // POST — upsert array of daily rows from sync script
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { days, project } = body;

      if (!Array.isArray(days) || !days.length) {
        return res.status(400).json({ error: 'days array required' });
      }

      for (const day of days) {
        await sql`
          INSERT INTO usage_daily (user_uuid, date, aiu, input_tokens, output_tokens, project, synced_at)
          VALUES (${uuid}, ${day.date}, ${day.aiu}, ${day.input_tokens}, ${day.output_tokens}, ${project ?? null}, NOW())
          ON CONFLICT (user_uuid, date) DO UPDATE SET
            aiu = EXCLUDED.aiu,
            input_tokens = EXCLUDED.input_tokens,
            output_tokens = EXCLUDED.output_tokens,
            project = COALESCE(EXCLUDED.project, usage_daily.project),
            synced_at = NOW()
        `;
      }

      return res.status(200).json({ ok: true, upserted: days.length });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // GET — return daily rows for a given month (defaults to current)
  if (req.method === 'GET') {
    try {
      const month = req.query.month || new Date().toISOString().slice(0, 7);

      const rows = await sql`
        SELECT date, aiu, input_tokens, output_tokens, project, synced_at
        FROM usage_daily
        WHERE user_uuid = ${uuid}
          AND TO_CHAR(date, 'YYYY-MM') = ${month}
        ORDER BY date ASC
      `;

      return res.status(200).json(rows.map(r => ({
        date: r.date,
        aiu: parseFloat(r.aiu),
        input_tokens: parseInt(r.input_tokens),
        output_tokens: parseInt(r.output_tokens),
        project: r.project,
        synced_at: r.synced_at,
      })));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'method not allowed' });
};
