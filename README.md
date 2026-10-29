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

## Live chat setup

Visitors get a floating chat button. They can chat as a guest or with a username and password, and you reply live from **Admin > Live Chat**. Chat ships switched off. Do the one-time setup below, then turn on **Admin > Settings > Live chat > Enable live chat for visitors**.

Chat visitors are signed in to Firebase too, so "signed in" no longer means "admin". The security rules now treat you as admin only if a marker document exists for your account. **Do steps 1 and 2 together.** If you publish the new rules without the marker, saving in the admin panel is denied until you add it (the admin panel shows a red banner with your UID when this happens).

1. **Find your admin UID.** Firebase console > Authentication > Users > copy the **User UID** of your admin account. (The Live Chat tab and the red banner also show it.)
2. **Create the admin marker.** Firebase console > Firestore Database > Start collection `raizenRoyale_admins` > Document ID = your UID > add any field, e.g. `enabled` = `true`. Clients cannot write to this collection.
3. **Publish the rules.** Firestore Database > Rules > paste the contents of `firestore.rules` > Publish.
4. **Enable Anonymous sign-in** (for guests). Authentication > Sign-in method > Anonymous > Enable. Keep Email/Password enabled: visitor accounts use it behind the scenes (`<username>@chat.raizen.example`), and so does your admin login.
5. **Turn it on.** Log in at `/admin` > Settings > Live chat > Enable > Save.

Notes:

- Visitor accounts have **no password reset** (there is no real email address). Tell visitors to remember their password, or just chat as a guest.
- Guests keep their chat on the same browser. A guest can later create an account from the chat menu and keeps their history.
- To test as a visitor, use a different browser or a private window. A browser signed in as admin does not show the chat button.
- Abuse protection: the rules block forged messages, fake timestamps and unread counts, but nothing can stop a script from creating many anonymous accounts. Turn on **Firebase App Check** (Build > App Check) and set a billing alert. Optional: Authentication > Settings > clear anonymous accounts automatically.
- Reserved usernames (admin, support, staff, ...) cannot be registered. Guest names are free text, so the admin list always shows a Guest or Account badge next to a name.

### Pictures in chat

Visitors and the admin can attach pictures (images only) with the picture button, by pasting a screenshot, or by dragging a file onto the chat.

- Every picture is re-encoded to JPEG in the browser before it is sent. That shrinks it, applies the camera rotation, and removes metadata and anything that is not pixels.
- Each message keeps a small thumbnail (about 10-20 KB). The full picture is stored in its own document (`raizenRoyale_chats/{uid}/images/{id}`) and is only downloaded when someone opens it.
- **Re-publish `firestore.rules`** after deploying this update (Firestore Database > Rules > Publish). Without the new rules, sending a picture is denied.
- Each picture can take up to about 600 KB of Firestore storage and rules cannot limit how many a visitor sends. Turn on **Firebase App Check** and set a billing alert (see above), and delete old conversations from the admin tab when you no longer need them (this also deletes their pictures).
