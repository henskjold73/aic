const { put, head } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { uuid } = req.query;

  if (!uuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) {
    return res.status(400).json({ error: 'invalid uuid' });
  }

  const blobPath = `usage/${uuid}.json`;

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      await put(blobPath, body, {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json',
      });
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('[aic] blob put error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'GET') {
    try {
      const blob = await head(blobPath);
      const response = await fetch(blob.url);
      const data = await response.json();
      return res.status(200).json(data);
    } catch {
      return res.status(404).json({ error: 'not found' });
    }
  }

  return res.status(405).json({ error: 'method not allowed' });
};
