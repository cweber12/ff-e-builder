import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithRedirect,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import type { User } from 'firebase/auth';

// ─── Firebase initialisation (once per module) ────────────────────────────

if (getApps().length === 0) {
  initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  });
}

export const auth = getAuth();

// ─── Auth actions ─────────────────────────────────────────────────────────

export const signInWithGoogle = async (): Promise<void> => {
  await signInWithRedirect(auth, new GoogleAuthProvider());
};

export const signInWithEmailPassword = async (email: string, password: string): Promise<void> => {
  await signInWithEmailAndPassword(auth, email, password);
};

export const createAccountWithEmailPassword = async (
  email: string,
  password: string,
): Promise<void> => {
  await createUserWithEmailAndPassword(auth, email, password);
};

export const signOut = async (): Promise<void> => {
  await firebaseSignOut(auth);
};

// ─── Auth context + provider ──────────────────────────────────────────────

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setIsLoading(false);
      }),
    [],
  );

  return <AuthContext.Provider value={{ user, isLoading }}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useAuthUser(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthUser must be called inside <AuthProvider>');
  return ctx;
}
