const { put, list } = require('@vercel/blob');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ENV = process.env.VERCEL_ENV === 'production' ? '' : `${process.env.VERCEL_ENV || 'development'}/`;

async function getTeam(id) {
  const { blobs } = await list({ prefix: `${ENV}teams/${id}.json`, limit: 1 });
  if (!blobs.length) return null;
  const r = await fetch(blobs[0].url);
  return r.json();
}

async function saveTeam(id, team) {
  await put(`${ENV}teams/${id}.json`, JSON.stringify(team), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json',
  });
}

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
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { uuid, name } = body || {};

    if (!uuid || !UUID_RE.test(uuid)) return res.status(400).json({ error: 'invalid uuid' });
    if (!name || !name.trim()) return res.status(400).json({ error: 'name required' });

    const team = await getTeam(id);
    if (!team) return res.status(404).json({ error: 'team not found' });

    // Update existing member or add new
    const existing = team.members.findIndex(m => m.uuid === uuid);
    const member = { uuid, name: name.trim().slice(0, 32), joined_at: new Date().toISOString() };
    if (existing >= 0) team.members[existing] = member;
    else team.members.push(member);

    await saveTeam(id, team);
    return res.status(200).json({ ok: true, team_name: team.name });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
