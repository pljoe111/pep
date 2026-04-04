import React from 'react';

interface InputProps {
  label?: string;
  error?: string;
  valid?: boolean;
  helperText?: string;
  id?: string;
  name?: string;
  type?: string;
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  required?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  autoComplete?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  className?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      valid,
      helperText,
      id,
      name,
      type = 'text',
      placeholder,
      value,
      defaultValue,
      disabled,
      required,
      inputMode,
      autoComplete,
      min,
      max,
      step,
      className = '',
      onChange,
      onBlur,
      onFocus,
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
        <input
          ref={ref}
          id={inputId}
          name={name}
          type={type}
          placeholder={placeholder}
          value={value}
          defaultValue={defaultValue}
          disabled={disabled}
          required={required}
          inputMode={inputMode}
          autoComplete={autoComplete}
          min={min}
          max={max}
          step={step}
          onChange={onChange}
          onBlur={onBlur}
          onFocus={onFocus}
          className={[
            'w-full rounded-xl border px-4 py-3 text-base text-text bg-surface',
            'placeholder:text-text-3',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
            'transition-colors duration-150',
            'min-h-[44px]',
            valid ? 'border-success' : error ? 'border-danger' : 'border-border',
            disabled ? 'opacity-50 cursor-not-allowed bg-surface-a' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        {helperText && !error && <p className="text-sm text-text-2">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
