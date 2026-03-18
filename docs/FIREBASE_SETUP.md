# Instrukcja Konfiguracji Firebase (Vercel)

CEO, aby system SIG ERP działał poprawnie na nowym stosie technologicznym, musisz dodać poniższe zmienne środowiskowe w panelu Vercel (Settings -> Environment Variables).

### 1. Klucze Publiczne (Client SDK)
Klucze te znajdziesz w **Firebase Console -> Project Settings -> General -> Your Apps -> SDK setup and configuration**.

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

### 2. Klucz Prywatny (Admin SDK - KRYTYCZNE)
Ten klucz jest niezbędny do bezpiecznych operacji po stronie serwera.
1. Wejdź w **Firebase Console -> Project Settings -> Service Accounts**.
2. Kliknij **Generate New Private Key**.
3. Pobierz plik JSON.
4. Skopiuj **całą zawartość** tego pliku i wklej jako wartość zmiennej:
- `FIREBASE_SERVICE_ACCOUNT_KEY`

---
> [!IMPORTANT]
> Google Auth musi być włączone w sekcji **Authentication -> Sign-in method** w konsoli Firebase, aby Gatekeeper mógł działać.
