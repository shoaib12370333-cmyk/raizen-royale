// /api/create-checkout.js
// Vercel Serverless Function — runs on the server, never in the browser.
// Keeps the CashTap secret key safe: it reads it from an environment
// variable (CASHTAP_SECRET_KEY) that you set in the Vercel dashboard,
// not from any file committed to your repo.

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Method not allowed" } });
  }

  const secretKey = process.env.CASHTAP_SECRET_KEY;
  if (!secretKey) {
    return res.status(500).json({ error: { message: "Server is missing CASHTAP_SECRET_KEY." } });
  }

  const { amount, line_items, customer_email, payment_methods, metadata } = req.body || {};

  if (!Number.isFinite(Number(amount)) || Number(amount) < 0.5 || Number(amount) > 100000) {
    return res.status(400).json({ error: { message: "amount must be at least 0.50 USD." } });
  }

  try {
    const cashtapRes = await fetch("https://api.cashtap.cash/checkout/v1/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        line_items: line_items || undefined,
        customer_email: customer_email || undefined,
        payment_methods: payment_methods || undefined,
        success_url: `${process.env.APP_URL || `https://${req.headers.host}`}/payments?paid=1`,
        cancel_url: `${process.env.APP_URL || `https://${req.headers.host}`}/payments`,
        metadata: metadata || undefined,
      }),
    });

    const data = await cashtapRes.json();

    if (!cashtapRes.ok) {
      return res.status(cashtapRes.status).json(data);
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: { message: "Could not reach CashTap.", detail: "upstream request failed" } });
  }
}