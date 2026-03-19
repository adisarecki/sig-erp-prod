import { initializeApp, getApps, cert, App, ServiceAccount } from "firebase-admin/app";

/**
 * 🔴 ATOMIC BUILD FIX
 *
 * The ONLY way to prevent 'The default Firebase app does not exist' during Vercel build:
 * 1. Do NOT import firebase-admin service modules (firestore, auth, storage) at the top level.
 *    Those imports trigger internal SDK checks that crash without an initialized app.
 * 2. Use dynamic require() INSIDE each getter, called only at runtime.
 * 3. initFirebaseAdmin NEVER throws - returns false gracefully if credentials are absent (build phase).
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
    // BUILD-TIME SAFETY: no credentials → return false, do not throw
    console.warn("[FIREBASE] Credentials absent (build phase). Skipping init.");
    return false;
  }

  initializeApp({
    credential,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });

  console.log("[FIREBASE] Admin initialized ✅");
  return true;
}

const ERR = "[FIREBASE] Not initialized. Add FIREBASE_SERVICE_ACCOUNT_JSON (or PROJECT_ID/EMAIL/KEY) to Vercel env vars.";

/** Firestore getter — dynamic require to avoid build-time SDK crash */
export const getAdminDb = () => {
  if (!initFirebaseAdmin() && getApps().length === 0) throw new Error(ERR);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getFirestore } = require("firebase-admin/firestore");
  return getFirestore() as ReturnType<typeof import("firebase-admin/firestore").getFirestore>;
};

/** Auth getter — dynamic require to avoid build-time SDK crash */
export const getAdminAuth = () => {
  if (!initFirebaseAdmin() && getApps().length === 0) throw new Error(ERR);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getAuth } = require("firebase-admin/auth");
  return getAuth() as ReturnType<typeof import("firebase-admin/auth").getAuth>;
};

/** Storage getter — dynamic require to avoid build-time SDK crash */
export const getAdminStorage = () => {
  if (!initFirebaseAdmin() && getApps().length === 0) throw new Error(ERR);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getStorage } = require("firebase-admin/storage");
  return getStorage() as ReturnType<typeof import("firebase-admin/storage").getStorage>;
};