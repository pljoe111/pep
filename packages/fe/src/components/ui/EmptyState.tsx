import React from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  heading: string;
  subtext?: string;
  ctaLabel?: string;
  onCta?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  heading,
  subtext,
  ctaLabel,
  onCta,
  className = '',
}: EmptyStateProps): React.ReactElement {
  return (
    <div
      className={[
        'flex flex-col items-center justify-center text-center py-16 px-6',
        className,
      ].join(' ')}
    >
      {icon && (
        <div className="mb-4 text-text-3 opacity-80" aria-hidden="true">
          {icon}
        </div>
      )}
      {!icon && (
        <div className="mb-4 text-text-3" aria-hidden="true">
          <svg
            className="w-16 h-16 mx-auto"
            viewBox="0 0 64 64"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="8" y="16" width="48" height="36" rx="4" />
            <path d="M8 24h48" />
            <circle cx="32" cy="38" r="6" />
            <path d="M29 38h6M32 35v6" />
          </svg>
        </div>
      )}
      <h3 className="text-xl font-bold text-text mb-2">{heading}</h3>
      {subtext && <p className="text-text-2 text-base max-w-xs">{subtext}</p>}
      {ctaLabel && onCta && (
        <div className="mt-6">
          <Button onClick={onCta} variant="primary" size="md">
            {ctaLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
