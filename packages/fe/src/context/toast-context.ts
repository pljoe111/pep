// Pure context definition — no React components, no hooks
// Kept separate so Toast.tsx (components) and useToast.ts (hook) can share it
import { createContext } from 'react';

export interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);
