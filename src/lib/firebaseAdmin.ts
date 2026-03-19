import { initializeApp, getApps, cert, ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

/**
 * Firebase Admin Singleton (Vercel-safe)
 */
export function initFirebaseAdmin() {
  if (getApps().length > 0) return;

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  let credential;

  if (projectId && clientEmail && privateKey) {
    credential = cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    } as ServiceAccount);
  } else if (serviceAccountJson) {
    const sa = JSON.parse(serviceAccountJson);
    if (sa.private_key) {
      sa.private_key = sa.private_key.replace(/\\n/g, "\n");
    }
    credential = cert(sa);
  } else {
    throw new Error(
      "❌ Firebase Admin credentials missing. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY or FIREBASE_SERVICE_ACCOUNT_JSON"
    );
  }

  initializeApp({
    credential,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });

  console.log("[FIREBASE] Admin initialized");
}

/**
 * SAFE GETTERS
 */
export const getAdminDb = () => {
  initFirebaseAdmin();
  return getFirestore();
};

export const getAdminAuth = () => {
  initFirebaseAdmin();
  return getAuth();
};

export const getAdminStorage = () => {
  initFirebaseAdmin();
  return getStorage();
};