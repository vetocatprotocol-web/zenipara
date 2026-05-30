/**
 * Improved metrics display with animations and visual hierarchy
 */

import { useEffect, useState } from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const colorBorder = {
  blue: 'border-blue-200 dark:border-blue-800',
  green: 'border-green-200 dark:border-green-800',
  red: 'border-red-200 dark:border-red-800',
  yellow: 'border-yellow-200 dark:border-yellow-800',
  purple: 'border-purple-200 dark:border-purple-800',
  gray: 'border-gray-200 dark:border-gray-800',
};

const colorAccent = {
  blue: 'text-blue-600 dark:text-blue-400',
  green: 'text-green-600 dark:text-green-400',
  red: 'text-red-600 dark:text-red-400',
  yellow: 'text-yellow-600 dark:text-yellow-400',
  purple: 'text-purple-600 dark:text-purple-400',
  gray: 'text-gray-600 dark:text-gray-400',
};

export function MetricCard({
  label,
  value,
  unit,
  icon,
  trend,
  color = 'blue',
  size = 'md',
  loading = false,
}: MetricCardProps) {
  const sizeClasses = {
    sm: { padding: 'p-4', title: 'text-xs', value: 'text-xl', trend: 'text-xs' },
    md: { padding: 'p-5', title: 'text-sm', value: 'text-2xl', trend: 'text-sm' },
    lg: { padding: 'p-6', title: 'text-base', value: 'text-3xl', trend: 'text-base' },
  }[size];

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl border bg-bg-card ${colorBorder[color]}
        ${sizeClasses.padding} transition-all duration-300 hover:shadow-md
      `}
    >
      {/* Gradient background accent */}
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-${color}-400 to-transparent opacity-0 group-hover:opacity-100 transition`} />

      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Label */}
          <p className={`font-semibold uppercase tracking-wide text-text-muted ${sizeClasses.title}`}>
            {label}
          </p>

          {/* Value with loading state */}
          {loading ? (
            <div className="mt-2 h-8 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          ) : (
            <div className={`mt-2 font-bold text-text-primary ${sizeClasses.value} flex items-baseline gap-1`}>
              <span className={colorAccent[color]}>{value}</span>
              {unit && <span className={`text-xs font-normal text-text-muted`}>{unit}</span>}
            </div>
          )}

          {/* Trend indicator */}
          {trend && !loading && (
            <p className={`mt-2 font-semibold ${sizeClasses.trend} ${trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </p>
          )}
        </div>

        {/* Icon */}
        {icon && !loading && (
          <div className={`flex items-center justify-center rounded-lg bg-${color}-50 dark:bg-${color}-900/20 p-3 text-2xl`}>
            {icon}
          </div>
        )}
      </div>

      {/* Loading pulse overlay */}
      {loading && (
        <div className="absolute inset-0 animate-pulse rounded-xl bg-white/20 dark:bg-black/10" />
      )}
    </div>
  );
}

interface MetricsGridProps {
  metrics: MetricCardProps[];
  columns?: 'auto' | 1 | 2 | 3 | 4 | 5;
  gap?: 'sm' | 'md' | 'lg';
}

export function MetricsGrid({ metrics, columns = 'auto', gap = 'md' }: MetricsGridProps) {
  const gapClass = {
    sm: 'gap-2',
    md: 'gap-3 lg:gap-4',
    lg: 'gap-4 lg:gap-6',
  }[gap];

  const columnClass = {
    auto: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5',
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5',
  }[columns];

  return (
    <div className={`grid ${columnClass} ${gapClass}`}>
      {metrics.map((metric, i) => (
        <MetricCard key={i} {...metric} />
      ))}
    </div>
  );
}

/**
 * Animated counter
 * Smoothly animates from oldValue to newValue
 */

export function AnimatedNumber({ value, duration = 300 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    let start = 0;
    let animationId: number;

    const animate = () => {
      const progress = start / duration;
      setDisplayValue(Math.floor(displayValue * progress + value * (1 - progress)));

      if (progress < 1) {
        start += 16; // ~60fps
        animationId = requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };

    if (displayValue !== value) {
      animationId = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(animationId);
    }
  }, [value, duration, displayValue]);

  return <>{displayValue}</>;
}
