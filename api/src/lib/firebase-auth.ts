import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { Env } from '../types';

/**
 * Initializes the Firebase Admin SDK once per isolate (cached).
 * Requires the nodejs_compat compatibility flag in wrangler.toml.
 *
 * NOTE: If Cloudflare Workers deployment raises issues with the Admin SDK,
 * swap this function for a manual RS256 JWT verifier using Web Crypto API:
 *   https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
 */
function ensureAdminInit(env: Env): void {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
        // Wrangler stores newlines as literal \n in secret values
        privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  }
}

/**
 * Verifies a Firebase ID token and returns the decoded UID.
 * Throws if the token is missing, expired, or invalid.
 */
export async function verifyFirebaseToken(token: string, env: Env): Promise<{ uid: string }> {
  ensureAdminInit(env);
  const decoded = await getAuth().verifyIdToken(token);
  return { uid: decoded.uid };
}
