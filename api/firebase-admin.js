import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminDb() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return null;
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const app = getApps()[0] || initializeApp({ credential: cert(serviceAccount) });
  return getFirestore(app);
}

export { getAdminDb };
