import { cn, deltaArrow, deltaColor, computeDelta, interpretDelta } from '@/lib/utils';

interface MetricWithComparisonProps {
  label: string;
  value: string;
  unit?: string;
  current?: number;
  baseline?: number;
  higherIsBad?: boolean;
  microtext?: string;
  loading?: boolean;
}

export function MetricWithComparison({
  label,
  value,
  unit,
  current,
  baseline,
  higherIsBad = true,
  microtext,
  loading,
}: MetricWithComparisonProps) {
  const { pct, direction } = computeDelta(current, baseline);
  const color = deltaColor(direction, higherIsBad);
  const arrow = deltaArrow(direction);
  const interpretation = interpretDelta(pct, direction, higherIsBad, label);

  return (
    <div className="space-y-0.5">
      <p className="text-[11px] uppercase tracking-wider text-text-muted font-medium">{label}</p>
      {loading ? (
        <div className="h-5 w-20 bg-bg-elevated rounded animate-pulse" />
      ) : (
        <div className="flex items-baseline gap-2">
          <span className="text-base font-semibold text-text-primary">
            {value}
            {unit && <span className="text-xs font-normal text-text-secondary ml-1">{unit}</span>}
          </span>
          {pct != null && (
            <span className={cn('text-xs font-medium', color)}>
              {arrow} {Math.abs(pct).toFixed(0)}% vs historical
            </span>
          )}
        </div>
      )}
      {microtext && <p className="text-[10px] text-text-muted leading-relaxed">{microtext}</p>}
      {pct != null && direction && (
        <p className="text-[11px] text-text-secondary leading-relaxed">{interpretation}</p>
      )}
    </div>
  );
}
