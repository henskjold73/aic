const { put, list } = require('@vercel/blob');

const ENV = process.env.VERCEL_ENV === 'production' ? '' : `${process.env.VERCEL_ENV || 'development'}/`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { uuid } = req.query;

  if (!uuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) {
    return res.status(400).json({ error: 'invalid uuid' });
  }

  const blobPath = `${ENV}usage/${uuid}.json`;

  async function getExisting() {
    const { blobs } = await list({ prefix: blobPath, limit: 1 });
    if (!blobs.length) return {};
    const r = await fetch(blobs[0].url);
    return r.json();
  }

  // POST — merge with existing to preserve fields like budget
  if (req.method === 'POST') {
    try {
      const incoming = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const existing = await getExisting();
      const merged = { ...existing, ...incoming };
      await put(blobPath, JSON.stringify(merged), { access: 'public', addRandomSuffix: false, contentType: 'application/json' });
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // PATCH — merge fields (budget from browser)
  if (req.method === 'PATCH') {
    try {
      const patch = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const existing = await getExisting();
      const merged = { ...existing, ...patch };
      await put(blobPath, JSON.stringify(merged), { access: 'public', addRandomSuffix: false, contentType: 'application/json' });
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // GET
  if (req.method === 'GET') {
    try {
      const { blobs } = await list({ prefix: blobPath, limit: 1 });
      if (!blobs.length) return res.status(404).json({ error: 'not found' });
      const response = await fetch(blobs[0].url);
      const data = await response.json();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'method not allowed' });
};
