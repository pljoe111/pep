// Convenience hook for accessing the toast context
// Imports from the pure context file, not from the component file
import { useContext } from 'react';
import { ToastContext } from '../context/toast-context';
import type { ToastContextValue } from '../context/toast-context';

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
