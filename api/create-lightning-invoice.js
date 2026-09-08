import { numberInRange, appUrl } from './_security.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const baseUrl = process.env.LNBITS_URL?.replace(/\/$/, '');
  const key = process.env.LNBITS_INVOICE_KEY;
  if (!baseUrl || !key) return res.status(503).json({ error: 'Lightning payments are not configured.' });

  const { amountSats, usdAmount, memo } = req.body || {};
  if (!numberInRange(amountSats, 1, 100000000) || !numberInRange(usdAmount, 0.01, 100000)) {
    return res.status(400).json({ error: 'Invalid payment amount.' });
  }
  try {
    const r = await fetch(`${baseUrl}/api/v1/payments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Api-Key': key },
      body: JSON.stringify({ out: false, amount: Math.round(Number(amountSats)), memo: String(memo || `Raizen Royale payment ($${Number(usdAmount).toFixed(2)})`).slice(0, 200), expiry: 1800 })
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.detail || data.error || 'Lightning invoice creation failed.' });
    return res.status(200).json({ payment_request: data.payment_request || data.bolt11, payment_hash: data.payment_hash || data.checking_id });
  } catch (e) { return res.status(502).json({ error: 'Could not reach Lightning provider.' }); }
}
