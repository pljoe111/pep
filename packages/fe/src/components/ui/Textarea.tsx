import React from 'react';

interface TextareaProps {
  label?: string;
  error?: string;
  helperText?: string;
  id?: string;
  name?: string;
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  required?: boolean;
  rows?: number;
  className?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helperText,
      id,
      name,
      placeholder,
      value,
      defaultValue,
      disabled,
      required,
      rows = 4,
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
        <textarea
          ref={ref}
          id={inputId}
          name={name}
          placeholder={placeholder}
          value={value}
          defaultValue={defaultValue}
          disabled={disabled}
          required={required}
          rows={rows}
          onChange={onChange}
          onBlur={onBlur}
          className={[
            'w-full rounded-xl border px-4 py-3 text-base text-text bg-surface',
            'placeholder:text-text-3 resize-y',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
            'transition-colors duration-150',
            error ? 'border-danger' : 'border-border',
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

Textarea.displayName = 'Textarea';
