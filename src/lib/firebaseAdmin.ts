import * as admin from "firebase-admin";

/**
 * Zintegrowany Singleton Firebase Admin (Fort Knox Initialization) 🛡️
 * Rozwiązuje błędy 'The default Firebase app does not exist' i 'Collecting page data' na Vercelu.
 */
export function getFirebaseAdmin() {
  if (admin.apps.length === 0) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (!serviceAccountJson) {
      if (process.env.NODE_ENV === "production") {
        console.warn("FIREBASE_SERVICE_ACCOUNT_JSON is missing! Firebase Admin will fail at runtime.");
      }
      return null;
    }

    try {
      const serviceAccount = JSON.parse(serviceAccountJson);

      // Naprawa klucza prywatnego (obsługa znaków nowej linii \n)
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
      console.log("[FIREBASE] Aplikacja zainicjalizowana pomyślnie.");
    } catch (error) {
      console.error("Firebase admin initialization error:", error);
      throw new Error("Failed to initialize Firebase Admin. Check FIREBASE_SERVICE_ACCOUNT_JSON.");
    }
  }
  return admin.app();
}

/**
 * Akceleratory (Safe Getters) dla usług Firebase
 */
export const getAdminDb = () => {
  const app = getFirebaseAdmin();
  if (!app) throw new Error("Firebase Admin not initialized - missing FIREBASE_SERVICE_ACCOUNT_JSON");
  return app.firestore();
};

export const getAdminAuth = () => {
  const app = getFirebaseAdmin();
  if (!app) throw new Error("Firebase Admin not initialized - missing FIREBASE_SERVICE_ACCOUNT_JSON");
  return app.auth();
};

export const getAdminStorage = () => {
  const app = getFirebaseAdmin();
  if (!app) throw new Error("Firebase Admin not initialized - missing FIREBASE_SERVICE_ACCOUNT_JSON");
  return app.storage();
};
