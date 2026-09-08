// /api/nowpayments-status.js
// Vercel Serverless Function — checks payment status for a given payment_id.

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server is missing NOWPAYMENTS_API_KEY." });
  }

  const { payment_id } = req.query;
  if (!payment_id) {
    return res.status(400).json({ error: "payment_id is required." });
  }

  try {
    const npRes = await fetch(`https://api.nowpayments.io/v1/payment/${payment_id}`, {
      headers: { "x-api-key": apiKey },
    });
    const data = await npRes.json();

    if (!npRes.ok) {
      return res.status(npRes.status).json(data);
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Could not reach NOWPayments.", detail: String(err) });
  }
}
