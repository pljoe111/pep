import React from 'react';
import { Link } from 'react-router-dom';

export function OfflinePage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 text-center">
      <div className="mb-6" aria-hidden="true">
        <svg
          className="w-24 h-24 mx-auto text-text-3"
          viewBox="0 0 96 96"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="48" cy="48" r="32" />
          <path d="M32 48h32M48 32v32" strokeLinecap="round" />
          <path d="M20 20L76 76" strokeLinecap="round" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-text mb-3">You&apos;re offline</h1>
      <p className="text-text-2 text-base max-w-xs mb-8">
        Check your connection and try again. Some content may be available from cache.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="px-6 py-3 bg-primary text-white font-semibold rounded-xl min-h-[44px] hover:bg-primary-d active:bg-primary-d transition-colors"
      >
        Retry
      </button>
      <Link to="/" className="mt-4 text-sm text-text-2 underline">
        Go home
      </Link>
    </div>
  );
}
