import type { InputHTMLAttributes, ReactNode } from 'react';
import { useUIStore } from '../../store/uiStore';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  helpText?: string;
}

export default function Input({
  label,
  error,
  leftIcon,
  rightIcon,
  helpText,
  id,
  className = '',
  ...props
}: InputProps) {
  const { displayDensity } = useUIStore();
  const isCompact = displayDensity === 'compact';
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-semibold text-text-primary">
          {label}
          {props.required && <span className="text-accent-red ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
            {leftIcon}
          </span>
        )}
        <input
          id={inputId}
          className={`
            w-full rounded-xl border border-surface bg-bg-card text-text-primary shadow-sm shadow-slate-900/[0.03]
            ${isCompact ? 'px-3 py-2 text-base sm:text-sm min-h-[40px]' : 'px-3 py-2.5 text-base sm:text-sm min-h-[44px]'}
            placeholder:text-text-muted
            transition-all duration-200 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15
            disabled:cursor-not-allowed disabled:opacity-50
            ${leftIcon ? 'pl-10' : ''} ${rightIcon ? 'pr-16' : ''}
            ${error ? 'border-accent-red focus:border-accent-red focus:ring-accent-red/50' : ''}
            ${className}
          `}
          {...props}
        />
        {rightIcon && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
            {rightIcon}
          </span>
        )}
      </div>
      {error && <p className="text-xs text-accent-red">{error}</p>}
      {helpText && !error && <p className="text-xs text-text-muted">{helpText}</p>}
    </div>
  );
}
