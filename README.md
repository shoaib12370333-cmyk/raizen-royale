# Raizen Royale

Production-oriented React/Vite gaming portal with Firebase-backed content management and server-side payment integrations.

## Local development

```bash
npm install
npm run dev
```

## Firebase security setup

1. Enable **Authentication > Sign-in method > Email/Password**.
2. Create your admin account under **Authentication > Users**.
3. Deploy `firestore.rules` in the Firebase console (Firestore Database > Rules).
4. Do **not** use the old `admin / raizen123` login. Admin authentication is now Firebase Authentication.

The public site can read games/payment methods/settings. Writes require an authenticated admin session.

## Vercel environment variables

Set these in Vercel Project Settings > Environment Variables:

- `APP_URL` — your production HTTPS origin, e.g. `https://your-domain.com`
- `CASHTAP_SECRET_KEY`
- `NOWPAYMENTS_API_KEY`
- `NOWPAYMENTS_IPN_SECRET`
- `LNBITS_URL`
- `LNBITS_INVOICE_KEY`

Payment secrets are only used by serverless functions and are never sent to the browser.

## Important

After changing environment variables, redeploy the Vercel project.

For NOWPayments, configure the IPN callback to `/api/nowpayments-ipn` (the invoice endpoint already sends the callback URL automatically).
