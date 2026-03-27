// State: toast notification list
// Why here: Toasts are UI-level ephemeral messages; context avoids prop drilling
// Updates: addToast() from anywhere, auto-dismiss after 4s

import React, { useCallback, useEffect, useState } from 'react';
import { ToastContext } from '../../context/toast-context';
import type { ToastContextValue } from '../../context/toast-context';

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  kind: ToastKind;
  message: string;
}

let counter = 0;

interface ToastProviderProps {
  children: React.ReactNode;
}

const kindClasses: Record<ToastKind, string> = {
  success: 'bg-emerald-600 text-white',
  error: 'bg-danger text-white',
  info: 'bg-info text-white',
};

const kindIcons: Record<ToastKind, React.ReactElement> = {
  success: (
    <svg
      className="w-5 h-5 flex-shrink-0"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  ),
  error: (
    <svg
      className="w-5 h-5 flex-shrink-0"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
        clipRule="evenodd"
      />
    </svg>
  ),
  info: (
    <svg
      className="w-5 h-5 flex-shrink-0"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
        clipRule="evenodd"
      />
    </svg>
  ),
};

function ToastItemComponent({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}): React.ReactElement {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      role="alert"
      className={[
        'flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg',
        'text-sm font-medium max-w-sm w-full',
        kindClasses[toast.kind],
      ].join(' ')}
    >
      {kindIcons[toast.kind]}
      <span className="flex-1">{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="opacity-75 hover:opacity-100 p-1 rounded"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
}

export function ToastProvider({ children }: ToastProviderProps): React.ReactElement {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((kind: ToastKind, message: string): void => {
    counter += 1;
    const id = `toast-${counter}`;
    setToasts((prev) => [...prev, { id, kind, message }]);
  }, []);

  const dismissToast = useCallback((id: string): void => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value: ToastContextValue = {
    success: useCallback((m: string) => addToast('success', m), [addToast]),
    error: useCallback((m: string) => addToast('error', m), [addToast]),
    info: useCallback((m: string) => addToast('info', m), [addToast]),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast container */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-20 left-0 right-0 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none md:bottom-6 md:right-4 md:left-auto md:items-end"
      >
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItemComponent toast={toast} onDismiss={dismissToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
