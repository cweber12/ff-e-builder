import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';

if (getApps().length === 0) {
  initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  });
}

export const auth = getAuth();

export async function getCurrentIdToken(): Promise<string | undefined> {
  if ('authStateReady' in auth && typeof auth.authStateReady === 'function') {
    await auth.authStateReady();
  }
  return auth.currentUser?.getIdToken(false);
}

export async function signInWithGoogle(): Promise<{ isNewUser: boolean }> {
  const result = await signInWithPopup(auth, new GoogleAuthProvider());
  return { isNewUser: getAdditionalUserInfo(result)?.isNewUser ?? false };
}

export async function signInWithEmailPassword(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function createAccountWithEmailPassword(
  email: string,
  password: string,
): Promise<void> {
  await createUserWithEmailAndPassword(auth, email, password);
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}
