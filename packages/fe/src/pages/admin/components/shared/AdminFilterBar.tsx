import React from 'react';

interface AdminFilterBarProps {
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}

export function AdminFilterBar({
  options,
  value,
  onChange,
}: AdminFilterBarProps): React.ReactElement {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={[
            'px-3 py-2 rounded-full border text-sm font-medium min-h-[36px] transition-colors',
            value === opt.value
              ? 'bg-primary-l border-primary text-primary'
              : 'border-border text-text-2 hover:border-text-3',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
