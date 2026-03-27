import React from 'react';

type SpinnerSize = 'sm' | 'md' | 'lg';
type SpinnerColor = 'primary' | 'white' | 'muted';

interface SpinnerProps {
  size?: SpinnerSize;
  color?: SpinnerColor;
  className?: string;
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-[3px]',
};

const colorClasses: Record<SpinnerColor, string> = {
  primary: 'border-primary border-t-transparent',
  white: 'border-white border-t-transparent',
  muted: 'border-text-3 border-t-transparent',
};

export function Spinner({
  size = 'md',
  color = 'primary',
  className = '',
}: SpinnerProps): React.ReactElement {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={[
        'inline-block rounded-full animate-spin',
        sizeClasses[size],
        colorClasses[color],
        className,
      ].join(' ')}
    />
  );
}
