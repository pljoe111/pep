import React from 'react';

interface ProgressBarProps {
  percent: number;
  className?: string;
  color?: 'primary' | 'success' | 'warning';
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const colorClasses = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
};

const sizeClasses = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

export function ProgressBar({
  percent,
  className = '',
  color = 'primary',
  showLabel = false,
  size = 'md',
}: ProgressBarProps): React.ReactElement {
  const clampedPercent = Math.min(100, Math.max(0, percent));

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        className={`flex-1 bg-stone-200 rounded-full overflow-hidden ${sizeClasses[size]}`}
        role="progressbar"
        aria-valuenow={clampedPercent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClasses[color]}`}
          style={{ width: `${clampedPercent}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-sm font-semibold text-text-2 min-w-[3rem] text-right">
          {Math.round(clampedPercent)}%
        </span>
      )}
    </div>
  );
}
