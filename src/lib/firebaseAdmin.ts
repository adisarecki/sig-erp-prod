import { initializeApp, getApps, cert, ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

/**
 * Firebase Admin Singleton (Vercel Build-Safe)
 *
 * KEY DESIGN DECISION:
 * - Does NOT throw if credentials are missing (allows Vercel build to pass)
 * - Throws only when a getter (getAdminDb/Auth/Storage) is called at RUNTIME without credentials
 * - This is necessary because `force-dynamic` does NOT prevent module import during build
 */
export function initFirebaseAdmin(): boolean {
  if (getApps().length > 0) return true;

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
    try {
      const sa = JSON.parse(serviceAccountJson);
      if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, "\n");
      credential = cert(sa);
    } catch (err) {
      console.error("[FIREBASE] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:", err);
      return false;
    }
  } else {
    // Build-time: credentials not available. Do NOT throw.
    // The getter functions will throw at runtime if called without credentials.
    console.warn("[FIREBASE] No credentials found - skipping initialization (build-time safe).");
    return false;
  }

  initializeApp({
    credential,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });

  console.log("[FIREBASE] Admin initialized ✅");
  return true;
}

/**
 * SAFE GETTERS - throw only at runtime if Firebase is genuinely not initialized
 */
export const getAdminDb = () => {
  const initialized = initFirebaseAdmin();
  if (!initialized && getApps().length === 0) {
    throw new Error("[FIREBASE] Not initialized. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID/EMAIL/KEY on Vercel.");
  }
  return getFirestore();
};

export const getAdminAuth = () => {
  const initialized = initFirebaseAdmin();
  if (!initialized && getApps().length === 0) {
    throw new Error("[FIREBASE] Not initialized. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID/EMAIL/KEY on Vercel.");
  }
  return getAuth();
};

export const getAdminStorage = () => {
  const initialized = initFirebaseAdmin();
  if (!initialized && getApps().length === 0) {
    throw new Error("[FIREBASE] Not initialized. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID/EMAIL/KEY on Vercel.");
  }
  return getStorage();
};