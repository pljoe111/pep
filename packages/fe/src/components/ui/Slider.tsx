import React from 'react';

interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  helperText?: string;
  showValue?: boolean;
  valueFormatter?: (value: number) => string;
}

export const Slider = ({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  helperText,
  showValue = false,
  valueFormatter = (v) => v.toString(),
  className = '',
  ...props
}: SliderProps) => {
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {(label || showValue) && (
        <div className="flex justify-between items-center">
          {label && <label className="text-sm font-medium text-text">{label}</label>}
          {showValue && (
            <span className="text-lg font-bold text-primary">{valueFormatter(value)}</span>
          )}
        </div>
      )}

      <div className="relative h-11 flex items-center">
        {/* Track Background */}
        <div className="absolute w-full h-2 bg-border rounded-lg overflow-hidden">
          {/* Active Track */}
          <div
            className="absolute top-0 left-0 h-full bg-primary transition-all duration-200"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Invisible Range Input for Interaction */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer z-10"
          {...props}
        />

        {/* Custom Thumb (Visual Only) */}
        <div
          className="absolute w-6 h-6 bg-surface border-2 border-primary rounded-full shadow-sm pointer-events-none z-20 transition-all duration-200"
          style={{
            left: `calc(${percentage}% - 12px)`,
          }}
        />
      </div>

      {helperText && <p className="text-xs text-text-2 leading-relaxed">{helperText}</p>}
    </div>
  );
};
