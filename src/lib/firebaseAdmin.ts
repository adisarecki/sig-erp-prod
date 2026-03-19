import { initializeApp, getApps, cert, ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

/**
 * Senior-Grade Firebase Admin Singleton 🛡️
 * Resolves Vercel build-time errors and 'default app top-level' issues.
 */
export function initFirebaseAdmin() {
  if (getApps().length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    let credential = null;

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
      } catch (e) {
        console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON", e);
      }
    }

    if (!credential) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("Missing Firebase Admin credentials (PROJECT_ID/EMAIL/KEY or JSON).");
      }
      return null;
    }

    initializeApp({
      credential,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
    console.log("[FIREBASE] Admin SDK Initialized Successfully.");
  }
}

/**
 * Safe Getters - Calling getFirestore() etc. only after init
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
