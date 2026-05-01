import { useState, type FormEvent } from 'react';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import {
  createAccountWithEmailPassword,
  signInWithEmailPassword,
  signInWithGoogle,
  signOut,
  useAuthUser,
} from '../lib/auth';

// ─── Sub-components ───────────────────────────────────────────────────────

function FullScreenSpinner() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-surface-muted">
      <div className="h-10 w-10 rounded-full border-4 border-brand-500 border-t-transparent animate-spin" />
    </main>
  );
}

export function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'sign-in' | 'create-account'>('sign-in');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clearErrors = () => setError('');

  const handleGoogleSignIn = async () => {
    clearErrors();
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearErrors();
    setIsSubmitting(true);

    try {
      if (authMode === 'create-account') {
        await createAccountWithEmailPassword(email.trim(), password);
      } else {
        await signInWithEmailPassword(email.trim(), password);
      }
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-surface-muted">
      <div className="bg-white rounded-2xl shadow-md p-10 flex flex-col items-center gap-6 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-brand-500">FF&amp;E Builder</h1>
        <p className="text-sm text-gray-500 text-center">
          Sign in to manage your projects and specifications.
        </p>

        {error && (
          <p
            role="alert"
            className="w-full rounded-md border border-danger-500/30 bg-red-50 px-3 py-2 text-sm text-danger-600"
          >
            {error}
          </p>
        )}

        <form
          onSubmit={(event) => void handleEmailSubmit(event)}
          className="flex w-full flex-col gap-3"
        >
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal focus:border-brand-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Password
            <input
              type="password"
              autoComplete={authMode === 'create-account' ? 'new-password' : 'current-password'}
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal focus:border-brand-500 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-brand-500 px-4 py-2 text-white font-medium hover:bg-brand-600 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            {authMode === 'create-account' ? 'Create account' : 'Sign in with email'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            clearErrors();
            setAuthMode((mode) => (mode === 'sign-in' ? 'create-account' : 'sign-in'));
          }}
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          {authMode === 'create-account'
            ? 'Already have an account? Sign in'
            : 'Need an account? Create one'}
        </button>

        <div className="flex w-full items-center gap-3 text-xs uppercase tracking-wide text-gray-600">
          <span className="h-px flex-1 bg-gray-200" />
          or
          <span className="h-px flex-1 bg-gray-200" />
        </div>

        <button
          type="button"
          onClick={() => void handleGoogleSignIn()}
          disabled={isSubmitting}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-800 font-medium hover:bg-gray-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        >
          Sign in with Google
        </button>
      </div>
    </main>
  );
}

function getAuthErrorMessage(err: unknown): string {
  const code = typeof err === 'object' && err !== null && 'code' in err ? String(err.code) : '';

  // User-initiated dismissals — show nothing so the button just re-enables.
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return '';
  }
  if (code === 'auth/popup-blocked') {
    return 'Sign-in popup was blocked. Allow popups for this site and try again.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'This domain is not authorized in Firebase. Add the deployed site domain in Firebase Authentication settings.';
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
    return 'Email or password is incorrect.';
  }
  if (code === 'auth/user-not-found') {
    return 'No account exists for that email.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'An account already exists for that email.';
  }
  if (code === 'auth/weak-password') {
    return 'Use a password with at least 6 characters.';
  }

  return 'Sign-in failed. Please try again.';
}

function UserChip() {
  const { user } = useAuthUser();
  return (
    <div className="fixed top-3 right-3 flex items-center gap-2 bg-white rounded-full shadow px-3 py-1.5 text-sm">
      {user?.photoURL && <img src={user.photoURL} alt="" className="h-6 w-6 rounded-full" />}
      <span className="max-w-[160px] truncate text-gray-700">{user?.email}</span>
      <button
        onClick={() => void signOut()}
        className="text-gray-400 hover:text-gray-600 ml-1"
        aria-label="Sign out"
      >
        ✕
      </button>
    </div>
  );
}

// ─── Gate ─────────────────────────────────────────────────────────────────

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuthUser();
  const bypassAuth = import.meta.env.VITE_E2E_BYPASS_AUTH === 'true';

  if (bypassAuth) return children;
  if (isLoading) return <FullScreenSpinner />;
  if (!user) return <Navigate to="/signin" replace />;

  return (
    <>
      <UserChip />
      {children}
    </>
  );
}
