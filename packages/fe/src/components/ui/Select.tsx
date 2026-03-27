import React from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  error?: string;
  helperText?: string;
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  required?: boolean;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLSelectElement>) => void;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      id,
      name,
      value,
      defaultValue,
      disabled,
      required,
      options,
      placeholder,
      className = '',
      onChange,
      onBlur,
    },
    ref
  ): React.ReactElement => {
    const inputId = id ?? name;
    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-text">
            {label}
            {required && <span className="text-danger ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={inputId}
            name={name}
            value={value}
            defaultValue={defaultValue}
            disabled={disabled}
            required={required}
            onChange={onChange}
            onBlur={onBlur}
            className={[
              'w-full rounded-xl border px-4 py-3 text-base text-text bg-surface',
              'appearance-none pr-10',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
              'transition-colors duration-150 min-h-[44px]',
              error ? 'border-danger' : 'border-border',
              disabled ? 'opacity-50 cursor-not-allowed bg-surface-a' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {/* Custom arrow */}
          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            <svg
              className="w-5 h-5 text-text-3"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        {helperText && !error && <p className="text-sm text-text-2">{helperText}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
