export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const baseUrl = process.env.LNBITS_URL?.replace(/\/$/, '');
  const key = process.env.LNBITS_INVOICE_KEY;
  const hash = String(req.query.payment_hash || '');
  if (!baseUrl || !key) return res.status(503).json({ error: 'Lightning payments are not configured.' });
  if (!/^[A-Za-z0-9_-]{8,256}$/.test(hash)) return res.status(400).json({ error: 'Invalid payment hash.' });
  try {
    const r = await fetch(`${baseUrl}/api/v1/payments/${encodeURIComponent(hash)}`, { headers: { 'X-Api-Key': key } });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: 'Payment lookup failed.' });
    return res.status(200).json({ paid: !!data.paid });
  } catch { return res.status(502).json({ error: 'Could not reach Lightning provider.' }); }
}
