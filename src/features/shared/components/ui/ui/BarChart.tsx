interface BarChartItem {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarChartItem[];
  title?: string;
  unit?: string;
  maxValue?: number;
  height?: number;
  showValues?: boolean;
}

/**
 * Simple CSS bar chart — no external charting library required.
 * Renders vertical bars with animated fill based on proportion.
 */
export default function BarChart({
  data,
  title,
  unit = '',
  maxValue,
  height = 140,
  showValues = true,
}: BarChartProps) {
  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-3">
      {title && <h4 className="text-sm font-semibold text-text-primary">{title}</h4>}
      <div className="flex items-end gap-2" style={{ height: `${height}px` }}>
        {data.map((item) => {
          const pct = max > 0 ? (item.value / max) * 100 : 0;
          return (
            <div key={item.label} className="flex flex-1 flex-col items-center gap-1.5">
              {showValues && (
                <span className="text-xs font-semibold text-text-primary">
                  {item.value}{unit}
                </span>
              )}
              <div
                className="relative w-full overflow-hidden rounded-t-md"
                style={{ height: `${height - 28}px` }}
              >
                {/* Background track */}
                <div className="absolute inset-0 rounded-t-md bg-surface/40" />
                {/* Filled bar */}
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-t-md transition-all duration-500"
                  style={{
                    height: `${pct}%`,
                    backgroundColor: item.color ?? 'var(--color-primary)',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {/* X-axis labels */}
      <div className="flex gap-2">
        {data.map((item) => (
          <div key={item.label} className="flex-1 text-center">
            <span className="text-[10px] text-text-muted leading-tight block">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
