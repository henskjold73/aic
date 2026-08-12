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

async function getMemberUsage(uuid) {
  try {
    const { blobs } = await list({ prefix: `${ENV}usage/${uuid}.json`, limit: 1 });
    if (!blobs.length) return null;
    const r = await fetch(blobs[0].url);
    return r.json();
  } catch { return null; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });

  const { id } = req.query;
  if (!id || !UUID_RE.test(id)) return res.status(400).json({ error: 'invalid id' });

  try {
    const team = await getTeam(id);
    if (!team) return res.status(404).json({ error: 'team not found' });

    const members = await Promise.all(
      team.members.map(async m => ({
        ...m,
        usage: await getMemberUsage(m.uuid),
      }))
    );

    return res.status(200).json({ ...team, members });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
