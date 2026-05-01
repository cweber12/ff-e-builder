import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGate, SignInPage } from './AuthGate';

const authMocks = vi.hoisted(() => ({
  createAccountWithEmailPassword: vi.fn(),
  signInWithEmailPassword: vi.fn(),
  signInWithGoogle: vi.fn(),
  signOut: vi.fn(),
  useAuthUser: vi.fn(),
}));

vi.mock('../lib/auth', () => authMocks);

describe('AuthGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.useAuthUser.mockReturnValue({ user: null, isLoading: false });
  });

  it('renders email/password sign-in and Google sign-in options', () => {
    render(<SignInPage />);

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in with email' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeInTheDocument();
  });

  it('submits email/password credentials', async () => {
    const user = userEvent.setup();
    authMocks.signInWithEmailPassword.mockResolvedValue(undefined);

    render(<SignInPage />);

    await user.type(screen.getByLabelText('Email'), 'designer@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Sign in with email' }));

    expect(authMocks.signInWithEmailPassword).toHaveBeenCalledWith(
      'designer@example.com',
      'secret123',
    );
  });

  it('can switch to create-account mode', async () => {
    const user = userEvent.setup();
    authMocks.createAccountWithEmailPassword.mockResolvedValue(undefined);

    render(<SignInPage />);

    await user.click(screen.getByRole('button', { name: 'Need an account? Create one' }));
    await user.type(screen.getByLabelText('Email'), 'new@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(authMocks.createAccountWithEmailPassword).toHaveBeenCalledWith(
      'new@example.com',
      'secret123',
    );
  });

  it('surfaces unauthorized-domain Google errors in the UI', async () => {
    const user = userEvent.setup();
    authMocks.signInWithGoogle.mockRejectedValue({ code: 'auth/unauthorized-domain' });

    render(<SignInPage />);

    await user.click(screen.getByRole('button', { name: 'Sign in with Google' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This domain is not authorized in Firebase',
    );
  });

  it('redirects protected content to sign-in when signed out', () => {
    render(
      <MemoryRouter initialEntries={['/projects']}>
        <Routes>
          <Route
            path="/projects"
            element={
              <AuthGate>
                <p>App</p>
              </AuthGate>
            }
          />
          <Route path="/signin" element={<p>Sign in route</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Sign in route')).toBeInTheDocument();
  });
});
