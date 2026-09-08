// /api/create-nowpayments-invoice.js
// Vercel Serverless Function — runs on the server, never in the browser.
// Reads the NOWPayments API key from an environment variable
// (NOWPAYMENTS_API_KEY) set in the Vercel dashboard.

import { randomUUID } from 'crypto';
import { getAdminDb } from './firebase-admin.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server is missing NOWPAYMENTS_API_KEY." });
  }

  const { amount, orderDescription } = req.body || {};

  if (!Number.isFinite(Number(amount)) || Number(amount) < 1 || Number(amount) > 100000) {
    return res.status(400).json({ error: "amount must be at least $1 USD." });
  }

  try {
    const npRes = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        price_amount: amount,
        price_currency: "usd",
        order_description: orderDescription || "Raizen Royale payment",
        success_url: `${process.env.APP_URL || `https://${req.headers.host}`}/payments?paid=1`,
        cancel_url: `${process.env.APP_URL || `https://${req.headers.host}`}/payments`,
        ipn_callback_url: `${process.env.APP_URL || `https://${req.headers.host}`}/api/nowpayments-ipn`,
        is_fixed_rate: true,
      }),
    });

    const data = await npRes.json();

    if (!npRes.ok) {
      return res.status(npRes.status).json(data);
    }

    const orderId = randomUUID();
    const db = getAdminDb();
    if (db && data.payment_id) {
      await db.collection('raizenRoyale_transactions').doc(orderId).set({
        orderId, provider: 'nowpayments', paymentId: String(data.payment_id),
        amountUsd: Number(amount), description: String(orderDescription || 'Raizen Royale payment').slice(0, 200),
        status: 'waiting', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });
    }
    return res.status(200).json({ ...data, order_id: orderId });
  } catch (err) {
    return res.status(500).json({ error: "Could not reach NOWPayments.", detail: "upstream request failed" });
  }
}