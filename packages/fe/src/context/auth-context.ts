// Pure context definition — no React components, no hooks
// Kept separate so AuthContext.tsx (provider component) and useAuth.ts (hook) can share it
import { createContext } from 'react';
import type { UserDto } from 'api-client';

export interface AuthContextValue {
  user: UserDto | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<boolean>;
  setUser: (user: UserDto) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
