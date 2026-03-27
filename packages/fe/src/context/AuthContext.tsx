// State: user object, authentication status, loading state, tokens in localStorage
// Why here: Auth state must be available app-wide; Context avoids prop drilling
//           Tokens live in localStorage (not state) so they survive page refresh and
//           are accessible synchronously by the axios interceptor
// Updates: login/logout/refreshTokens mutations, bootstrapped on mount via useEffect

import React, { useCallback, useEffect, useState } from 'react';
import type { UserDto } from 'api-client';
import { authApi } from '../api/apiClient';
import { queryClient } from '../api/queryClient';
import { AuthContext } from './auth-context';
import type { AuthContextValue } from './auth-context';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): React.ReactElement {
  const [user, setUser] = useState<UserDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Bootstrap: load user from API if token exists in localStorage
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setIsLoading(false);
      return;
    }

    authApi
      .me()
      .then((res) => {
        setUser(res.data);
      })
      .catch(() => {
        // Token may be expired; clear storage, user stays null
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    const res = await authApi.login({ email, password });
    const { user: loggedInUser, accessToken, refreshToken } = res.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    setUser(loggedInUser);
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout errors — clear state either way
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
      void queryClient.clear();
    }
  }, []);

  const refreshTokens = useCallback(async (): Promise<boolean> => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return false;
    try {
      const res = await authApi.refresh({ refreshToken });
      localStorage.setItem('accessToken', res.data.accessToken);
      localStorage.setItem('refreshToken', res.data.refreshToken);
      return true;
    } catch {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
      return false;
    }
  }, []);

  const value: AuthContextValue = {
    user,
    isAuthenticated: user !== null,
    isLoading,
    login,
    logout,
    refreshTokens,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
