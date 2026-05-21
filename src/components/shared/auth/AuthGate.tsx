import { useEffect, useState, type FormEvent } from 'react';
import type { ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  createAccountWithEmailPassword,
  signInWithEmailPassword,
  signInWithGoogle,
  signOut,
  useAuthUser,
} from '../../../lib/auth';
import { seedExampleProject } from '../../../data/seed';
import { useUserProfile } from '../../../hooks';
import { UserProfileModal } from '../modals/UserProfileModal';
import { DemoPage } from '../../../pages/DemoPage';

// ─── Sub-components ───────────────────────────────────────────────────────

function FullScreenSpinner() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="h-10 w-10 rounded-full border-4 border-brand-600 border-t-transparent animate-spin" />
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
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="border-y border-black/10 bg-canvas-chrome px-10 py-12 flex flex-col items-center gap-6 w-full max-w-sm shadow-sm">
        <div className="flex flex-col items-center gap-1.5">
          <p className="num text-[10px] font-semibold uppercase tracking-[0.24em] text-brand-700">
            Studio
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-neutral-950">
            Chill Design
          </h1>
        </div>
        <p className="text-sm text-neutral-500 text-center max-w-[28ch]">
          Sign in to manage your projects and specifications.
        </p>

        {error && (
          <p
            role="alert"
            className="w-full border border-danger-500/40 bg-danger-50 px-3 py-2 text-sm text-danger-600"
          >
            {error}
          </p>
        )}

        <form
          onSubmit={(event) => void handleEmailSubmit(event)}
          className="flex w-full flex-col gap-3"
        >
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="input-base normal-case tracking-normal"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
            Password
            <input
              type="password"
              autoComplete={authMode === 'create-account' ? 'new-password' : 'current-password'}
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input-base normal-case tracking-normal"
            />
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-1 w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
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
          className="text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          {authMode === 'create-account'
            ? 'Already have an account? Sign in'
            : 'Need an account? Create one'}
        </button>

        <div className="flex w-full items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
          <span className="h-px flex-1 bg-black/10" />
          or
          <span className="h-px flex-1 bg-black/10" />
        </div>

        <button
          type="button"
          onClick={() => void handleGoogleSignIn()}
          disabled={isSubmitting}
          className="w-full rounded-md border border-black/15 bg-canvas-chrome px-4 py-2 text-sm font-semibold text-neutral-800 transition-colors hover:border-brand-500 hover:bg-canvas-shell hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
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
          className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full ring-1 ring-black/15 transition-all hover:ring-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
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
            <div className="absolute right-0 top-full z-40 mt-1 min-w-44 rounded-sm border border-black/10 bg-canvas-chrome py-1 shadow-lg">
              {(profile?.name || user?.email) && (
                <p className="truncate border-b border-black/10 px-3 py-1.5 text-xs text-neutral-500">
                  {profile?.name || user?.email}
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setProfileOpen(true);
                }}
                className="w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-canvas-shell hover:text-brand-700"
              >
                Update profile
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate('/company');
                }}
                className="w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-canvas-shell hover:text-brand-700"
              >
                Company profile
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate('/projects');
                }}
                className="w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-canvas-shell hover:text-brand-700"
              >
                Projects
              </button>
              <div className="my-1 border-t border-black/10" />
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  void signOut();
                }}
                className="w-full px-3 py-2 text-left text-sm text-danger-600 hover:bg-canvas-shell"
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
    <header className="no-print sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between border-b border-black/10 bg-canvas-chrome/95 px-4 backdrop-blur md:px-6">
      <Link
        to="/projects"
        className="font-display text-sm font-semibold tracking-tight text-brand-700 hover:text-brand-800 transition-colors"
      >
        Chill Design Studio
      </Link>
      <UserMenu />
    </header>
  );
}

// ─── Demo layout (unauthorized users) ─────────────────────────────────────

function DemoLayout() {
  return (
    <>
      <header className="no-print sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between border-b border-black/10 bg-canvas-chrome/95 px-4 backdrop-blur md:px-6">
        <span className="font-display text-sm font-semibold tracking-tight text-brand-700">
          Chill Design Studio
        </span>
        <button
          type="button"
          onClick={() => void signOut()}
          className="text-sm text-neutral-500 hover:text-neutral-800"
        >
          Sign out
        </button>
      </header>
      <div className="border-b border-amber-500/40 bg-amber-50 px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-800">
        Demo mode — your account is not yet authorized. Contact the studio administrator to request
        access.
      </div>
      <DemoPage />
    </>
  );
}

// ─── Authorization check (runs after Firebase auth is confirmed) ───────────

function AuthorizedGate({ children }: { children: ReactNode }) {
  const { data: profile, isLoading } = useUserProfile();

  if (isLoading || !profile) return <FullScreenSpinner />;
  if (!profile.authorized) return <DemoLayout />;

  return (
    <>
      <TopBar />
      {children}
    </>
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

  return <AuthorizedGate>{children}</AuthorizedGate>;
}
