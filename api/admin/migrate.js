// Migration complete — this file is no longer needed.
module.exports = async function handler(req, res) {
  res.status(410).json({ message: 'Migration already completed. Blob storage removed.' });
};
