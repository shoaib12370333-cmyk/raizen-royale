// /api/checkout-status.js
// Vercel Serverless Function — retrieves a checkout session's status.
// Called by the frontend to poll whether a payment has completed,
// without ever exposing the secret key to the browser.

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== "GET") {
    return res.status(405).json({ error: { message: "Method not allowed" } });
  }

  const secretKey = process.env.CASHTAP_SECRET_KEY;
  if (!secretKey) {
    return res.status(500).json({ error: { message: "Server is missing CASHTAP_SECRET_KEY." } });
  }

  const { session_id } = req.query;
  if (!session_id) {
    return res.status(400).json({ error: { message: "session_id is required." } });
  }

  try {
    const cashtapRes = await fetch(`https://api.cashtap.cash/checkout/v1/sessions/${session_id}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    const data = await cashtapRes.json();

    if (!cashtapRes.ok) {
      return res.status(cashtapRes.status).json(data);
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: { message: "Could not reach CashTap.", detail: String(err) } });
  }
}