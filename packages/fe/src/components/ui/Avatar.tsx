import React from 'react';

interface AvatarProps {
  username?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-base',
};

function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

function getColor(username: string): string {
  const colors = [
    'bg-teal-500',
    'bg-blue-500',
    'bg-purple-500',
    'bg-amber-500',
    'bg-emerald-500',
    'bg-rose-500',
    'bg-indigo-500',
  ];
  const idx = username.charCodeAt(0) % colors.length;
  return colors[idx] ?? 'bg-teal-500';
}

export function Avatar({ username, size = 'md', className = '' }: AvatarProps): React.ReactElement {
  if (username) {
    return (
      <div
        aria-label={username}
        className={[
          'rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0',
          getColor(username),
          sizeClasses[size],
          className,
        ].join(' ')}
      >
        {getInitials(username)}
      </div>
    );
  }

  return (
    <div
      aria-label="Anonymous user"
      className={[
        'rounded-full flex items-center justify-center bg-stone-300 text-stone-600 font-semibold flex-shrink-0',
        sizeClasses[size],
        className,
      ].join(' ')}
    >
      ?
    </div>
  );
}
