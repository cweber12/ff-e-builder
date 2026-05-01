import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  getRedirectResult,
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
  redirectError: unknown;
  clearRedirectError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [redirectError, setRedirectError] = useState<unknown>(null);

  const clearRedirectError = () => setRedirectError(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsLoading(false);
    });

    // Process any pending redirect result once on app start.
    // Success is handled by onAuthStateChanged above; we only need this for error reporting.
    // The .catch() ensures COOP-related iframe failures don't surface as unhandled rejections.
    getRedirectResult(auth)
      .then((result) => {
        if (result) setRedirectError(null);
      })
      .catch((err: unknown) => setRedirectError(err));

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, redirectError, clearRedirectError }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useAuthUser(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthUser must be called inside <AuthProvider>');
  return ctx;
}
