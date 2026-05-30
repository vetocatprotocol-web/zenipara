/**
 * Improved status badge component with animations and variants
 */

interface StatusBadgeProps {
  status: string;
  label: string;
  icon?: string;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray';
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  pulse?: boolean;
  className?: string;
}

const colorConfig = {
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-100',
    border: 'border-blue-200 dark:border-blue-800',
    pulse: 'bg-blue-400',
  },
  green: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    text: 'text-green-700 dark:text-green-100',
    border: 'border-green-200 dark:border-green-800',
    pulse: 'bg-green-400',
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-100',
    border: 'border-red-200 dark:border-red-800',
    pulse: 'bg-red-400',
  },
  yellow: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    text: 'text-yellow-700 dark:text-yellow-100',
    border: 'border-yellow-200 dark:border-yellow-800',
    pulse: 'bg-yellow-400',
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    text: 'text-purple-700 dark:text-purple-100',
    border: 'border-purple-200 dark:border-purple-800',
    pulse: 'bg-purple-400',
  },
  gray: {
    bg: 'bg-gray-50 dark:bg-gray-900/20',
    text: 'text-gray-700 dark:text-gray-100',
    border: 'border-gray-200 dark:border-gray-800',
    pulse: 'bg-gray-400',
  },
};

const sizeConfig = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
  lg: 'px-4 py-2 text-base',
};

export function StatusBadge({
  status,
  label,
  icon,
  color = 'blue',
  size = 'md',
  animated = false,
  pulse = false,
  className = '',
}: StatusBadgeProps) {
  const colors = colorConfig[color];
  const sizeClass = sizeConfig[size];

  return (
    <div
      className={`
        inline-flex items-center gap-1 rounded-full border font-semibold shadow-sm
        ${colors.bg} ${colors.text} ${colors.border}
        ${sizeClass} ${animated ? 'transition-all duration-300' : ''}
        ${pulse ? 'relative' : ''}
        ${className}
      `}
      title={status}
    >
      {pulse && (
        <span className={`absolute inset-0 rounded-full animate-pulse ${colors.pulse} -z-10 opacity-40`} />
      )}
      {icon && <span className="text-[10px] leading-none">{icon}</span>}
      <span>{label}</span>
    </div>
  );
}

/**
 * Status badge with loading state
 */
export function StatusBadgeWithLoading({
  isLoading,
  ...props
}: StatusBadgeProps & { isLoading?: boolean }) {
  if (isLoading) {
    return (
      <div className={`inline-flex items-center gap-2 ${sizeConfig[props.size ?? 'md']}`}>
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-current" />
        <span className="text-sm text-text-muted">Memperbarui...</span>
      </div>
    );
  }
  return <StatusBadge {...props} />;
}

/**
 * Multi-status indicator showing multiple statuses
 */
interface MultiStatusProps {
  statuses: Array<{
    label: string;
    count: number;
    color: keyof typeof colorConfig;
    icon?: string;
  }>;
  layout?: 'horizontal' | 'vertical';
  size?: 'sm' | 'md';
}

export function MultiStatusIndicator({ statuses, layout = 'horizontal', size = 'sm' }: MultiStatusProps) {
  return (
    <div className={`flex gap-2 ${layout === 'vertical' ? 'flex-col' : 'flex-row items-center flex-wrap'}`}>
      {statuses.map((status) => (
        <div key={status.label} className="flex items-center gap-1">
          <StatusBadge
            status={status.label}
            label={status.label}
            color={status.color}
            icon={status.icon}
            size={size}
          />
          <span className="ml-1 font-bold text-text-primary tabular-nums">{status.count}</span>
        </div>
      ))}
    </div>
  );
}
