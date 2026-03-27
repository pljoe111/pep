import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
};

export function Card({
  children,
  className = '',
  onClick,
  padding = 'md',
}: CardProps): React.ReactElement {
  const isClickable = onClick !== undefined;
  return (
    <div
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick();
            }
          : undefined
      }
      className={[
        'bg-surface rounded-2xl border border-border',
        'shadow-sm',
        paddingClasses[padding],
        isClickable
          ? 'cursor-pointer hover:shadow-md transition-shadow duration-150 active:scale-[0.99]'
          : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
