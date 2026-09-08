// /api/nowpayments-ipn.js
// Vercel Serverless Function — receives Instant Payment Notifications (IPN)
// from NOWPayments whenever a payment's status changes. Verifies the
// signature using NOWPAYMENTS_IPN_SECRET before trusting the payload.
//
// This is a receiving endpoint only. The frontend still polls
// /api/nowpayments-status for simplicity, but this endpoint logs
// confirmed payments server-side as a reliable source of truth.

import crypto from "crypto";
import { getAdminDb } from "./firebase-admin.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

// NOWPayments signs a JSON object with keys sorted alphabetically.
function sortObject(obj) {
  if (Array.isArray(obj)) return obj.map(sortObject);
  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortObject(obj[key]);
        return acc;
      }, {});
  }
  return obj;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret) {
    return res.status(500).json({ error: "Server is missing NOWPAYMENTS_IPN_SECRET." });
  }

  const raw = await readRawBody(req);
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (err) {
    return res.status(400).json({ error: "Invalid JSON body." });
  }

  const signature = req.headers["x-nowpayments-sig"];
  const sortedPayload = JSON.stringify(sortObject(payload));
  const computed = crypto.createHmac("sha512", secret).update(sortedPayload).digest("hex");

  if (!signature || computed !== signature) {
    return res.status(401).json({ error: "Invalid signature." });
  }

  // Signature verified — payload is genuinely from NOWPayments.
  // payload.payment_status will be one of: waiting, confirming, confirmed,
  // sending, partially_paid, finished, failed, refunded, expired.
  console.log("NOWPayments IPN verified:", payload.payment_id, payload.payment_status);

  try {
    const db = getAdminDb();
    if (db && payload.payment_id) {
      const ref = db.collection("raizenRoyale_transactions").where("paymentId", "==", String(payload.payment_id)).limit(1);
      const snap = await ref.get();
      const update = {
        provider: "nowpayments", paymentId: String(payload.payment_id),
        status: String(payload.payment_status || "unknown"),
        payAddress: payload.pay_address || null,
        actuallyPaid: payload.actually_paid ?? null,
        actuallyPaidCurrency: payload.pay_currency || null,
        updatedAt: new Date().toISOString(),
        rawStatus: payload.payment_status || null
      };
      if (!snap.empty) await snap.docs[0].ref.set(update, { merge: true });
      else await db.collection("raizenRoyale_transactions").doc(`np_${String(payload.payment_id)}`).set(update, { merge: true });
    }
  } catch (err) {
    console.error("IPN persistence failed");
  }

  return res.status(200).json({ received: true });
}
