import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  valid?: boolean;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, valid, helperText, className = '', ...props }, ref): React.ReactElement => {
    const inputId = props.id ?? props.name;
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-text">
            {label}
            {props.required && <span className="text-danger ml-1">*</span>}
          </label>
        )}
        <input
          ref={ref}
          {...props}
          id={inputId}
          className={[
            'w-full rounded-xl border px-4 py-3 text-base text-text bg-surface',
            'placeholder:text-text-3',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
            'transition-colors duration-150',
            'min-h-[44px]',
            valid ? 'border-success' : error ? 'border-danger' : 'border-border',
            props.disabled ? 'opacity-50 cursor-not-allowed bg-surface-a' : '',
            props.readOnly ? 'bg-surface-a' : '',
            className,
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
