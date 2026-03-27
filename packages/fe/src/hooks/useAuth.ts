// Convenience hook for accessing auth context
// Imports from the pure context file, not from the component file (react-refresh compliance)
import { useContext } from 'react';
import { AuthContext } from '../context/auth-context';
import type { AuthContextValue } from '../context/auth-context';

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
