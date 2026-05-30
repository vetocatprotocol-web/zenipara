import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children: ReactNode;
}

const variants = {
  primary: 'bg-gradient-to-br from-primary to-blue-700 text-white shadow-md shadow-primary/30 hover:shadow-lg hover:shadow-primary/35 hover:from-blue-600 hover:to-blue-700',
  secondary: 'border border-surface bg-bg-card text-text-primary hover:bg-slate-50 hover:border-slate-300 dark:bg-surface/40 dark:hover:bg-surface dark:border-surface/80',
  danger: 'bg-gradient-to-br from-accent-red to-red-700 text-white shadow-sm shadow-accent-red/30 hover:shadow-md hover:shadow-accent-red/35 hover:from-red-500 hover:to-red-700',
  ghost: 'text-text-muted hover:bg-slate-100 hover:text-text-primary dark:hover:bg-surface/60',
  outline: 'border border-surface bg-transparent text-text-primary hover:border-primary/50 hover:bg-primary/5 hover:text-primary',
};

const sizes = {
  sm: 'px-3 py-2 text-sm min-h-[40px]',
  md: 'px-4 py-2.5 text-sm min-h-[44px]',
  lg: 'px-6 py-3 text-base min-h-[48px]',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    isLoading,
    leftIcon,
    rightIcon,
    children,
    className = '',
    disabled,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`
        inline-flex items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap
        transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/35 focus:ring-offset-2 focus:ring-offset-transparent
        active:scale-[0.96] active:brightness-95
        disabled:cursor-not-allowed disabled:opacity-50
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      disabled={disabled || isLoading}
      aria-disabled={disabled || isLoading}
      aria-busy={isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
      ) : leftIcon ? (
        <span className="flex-shrink-0" aria-hidden="true">{leftIcon}</span>
      ) : null}
      {children}
      {!isLoading && rightIcon && (
        <span className="flex-shrink-0" aria-hidden="true">{rightIcon}</span>
      )}
    </button>
  );
});

export default Button;
