import { useEffect, useState, type FormEvent } from 'react';
import type { ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  createAccountWithEmailPassword,
  signInWithEmailPassword,
  signInWithGoogle,
  signOut,
} from '../../lib/auth';
import { useAuthUser } from '../../lib/auth-state';
import { seedExampleProject } from '../../lib/seed';
import { useUserProfile } from '../../hooks';
import { UserProfileModal } from './UserProfileModal';

// ─── Sub-components ───────────────────────────────────────────────────────

function FullScreenSpinner() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-surface-muted">
      <div className="h-10 w-10 rounded-full border-4 border-brand-500 border-t-transparent animate-spin" />
    </main>
  );
}

export function SignInPage() {
  const { user, isLoading } = useAuthUser();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/projects';

  useEffect(() => {
    if (!isLoading && user) navigate(from, { replace: true });
  }, [user, isLoading, navigate, from]);

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
      const { isNewUser } = await signInWithGoogle();
      if (isNewUser) void seedExampleProject().catch(() => {});
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
        void seedExampleProject().catch(() => {});
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
        <h1 className="text-2xl font-bold text-brand-500">Chill Design Studio</h1>
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

function UserMenu() {
  const { user } = useAuthUser();
  const navigate = useNavigate();
  const { data: profile } = useUserProfile();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="User menu"
          aria-expanded={open}
          aria-haspopup="true"
          className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full ring-2 ring-gray-200 transition-all hover:ring-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-brand-100 text-xs font-semibold text-brand-700">
              {((profile?.name ?? user?.email ?? '?')[0] ?? '?').toUpperCase()}
            </span>
          )}
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
            <div className="absolute right-0 top-full z-40 mt-1 min-w-44 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
              {(profile?.name || user?.email) && (
                <p className="truncate border-b border-gray-100 px-3 py-1.5 text-xs text-gray-500">
                  {profile?.name || user?.email}
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setProfileOpen(true);
                }}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                Update profile
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate('/projects');
                }}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                Projects
              </button>
              <div className="my-1 border-t border-gray-100" />
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  void signOut();
                }}
                className="w-full px-3 py-2 text-left text-sm text-danger-600 hover:bg-gray-50"
              >
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
      <UserProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}

function TopBar() {
  return (
    <header className="no-print sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 md:px-6">
      <Link
        to="/projects"
        className="text-sm font-bold tracking-tight text-brand-500 hover:text-brand-600 transition-colors"
      >
        Chill Design Studio
      </Link>
      <UserMenu />
    </header>
  );
}

// ─── Gate ─────────────────────────────────────────────────────────────────

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuthUser();
  const location = useLocation();
  const bypassAuth = import.meta.env.VITE_E2E_BYPASS_AUTH === 'true';

  if (bypassAuth) return children;
  if (isLoading) return <FullScreenSpinner />;
  if (!user) return <Navigate to="/signin" state={{ from: location.pathname }} replace />;

  return (
    <>
      <TopBar />
      {children}
    </>
  );
}
