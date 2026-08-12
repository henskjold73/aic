const { put } = require('@vercel/blob');

const ENV = process.env.VERCEL_ENV === 'production' ? '' : `${process.env.VERCEL_ENV || 'development'}/`;

// POST /api/team — create a new team
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const name = (body?.name || 'My Team').slice(0, 64);

    const id = crypto.randomUUID();
    const team = { id, name, members: [], created_at: new Date().toISOString() };

    await put(`${ENV}teams/${id}.json`, JSON.stringify(team), {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json',
    });

    return res.status(200).json({ id, name });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
