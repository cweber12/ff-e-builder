import { createContext, useContext } from 'react';
import type { User } from 'firebase/auth';

export interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuthUser(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthUser must be called inside <AuthProvider>');
  return ctx;
}
