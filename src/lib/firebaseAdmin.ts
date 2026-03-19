// /lib/firebaseAdmin.ts
import { initializeApp, getApps, cert, ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

/**
 * 🔹 Firebase Admin Singleton (Vercel-safe, Next.js App Router)
 * - Init only once
 * - Safe getters
 * - Throws on missing ENV (production-safe)
 */
export function initFirebaseAdmin() {
  if (getApps().length > 0) return; // ✅ already initialized

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  let credential: ServiceAccount | undefined;

  if (projectId && clientEmail && privateKey) {
    credential = cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    } as ServiceAccount);
  } else if (serviceAccountJson) {
    try {
      const sa = JSON.parse(serviceAccountJson);
      if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, "\n");
      credential = cert(sa);
    } catch (err) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON", err);
    }
  }

  if (!credential) {
    throw new Error(
      "❌ Firebase Admin credentials missing. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY or FIREBASE_SERVICE_ACCOUNT_JSON"
    );
  }

  initializeApp({
    credential,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });

  console.log("[FIREBASE] Admin SDK initialized ✅");
}

/**
 * 🔹 Safe Firestore getter
 */
export const getAdminDb = () => {
  initFirebaseAdmin();
  return getFirestore();
};

/**
 * 🔹 Safe Auth getter
 */
export const getAdminAuth = () => {
  initFirebaseAdmin();
  return getAuth();
};

/**
 * 🔹 Safe Storage getter
 */
export const getAdminStorage = () => {
  initFirebaseAdmin();
  return getStorage();
};