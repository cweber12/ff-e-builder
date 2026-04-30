import type { ReactNode } from 'react';
import { signInWithGoogle, signOut, useAuthUser } from '../lib/auth';

// ─── Sub-components ───────────────────────────────────────────────────────

function FullScreenSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-muted">
      <div className="h-10 w-10 rounded-full border-4 border-brand-primary border-t-transparent animate-spin" />
    </div>
  );
}

function SignInCard() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-muted">
      <div className="bg-white rounded-2xl shadow-md p-10 flex flex-col items-center gap-6 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-brand-primary">FF&amp;E Builder</h1>
        <p className="text-sm text-gray-500 text-center">
          Sign in to manage your projects and specifications.
        </p>
        <button
          onClick={() => void signInWithGoogle()}
          className="w-full rounded-lg bg-brand-primary px-4 py-2 text-white font-medium hover:opacity-90 transition-opacity"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
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

  if (isLoading) return <FullScreenSpinner />;
  if (!user) return <SignInCard />;

  return (
    <>
      <UserChip />
      {children}
    </>
  );
}
