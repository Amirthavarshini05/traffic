import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  unit?: string;
  status?: 'success' | 'warning' | 'critical' | 'neutral';
  loading?: boolean;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  trendBad?: boolean;
  subtext?: string;
  explanation?: string;
}

const statusColors: Record<string, string> = {
  success: 'text-success',
  warning: 'text-warning',
  critical: 'text-critical',
  neutral: 'text-text-primary',
};

export function KpiCard({
  label,
  value,
  icon,
  unit,
  status = 'neutral',
  loading,
  trend,
  trendDirection,
  trendBad,
  subtext,
  explanation,
}: KpiCardProps) {
  return (
    <div className="panel px-3 py-2 flex flex-col justify-between min-w-0 h-full">
      <div className="flex items-center justify-between gap-1.5">
        <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold truncate">
          {label}
        </p>
        {icon && (
          <div className="shrink-0 w-6 h-6 rounded bg-bg-elevated flex items-center justify-center text-accent-light">
            {icon}
          </div>
        )}
      </div>

      <div className="my-0.5">
        {loading ? (
          <div className="h-5 w-16 bg-bg-elevated rounded animate-pulse my-1" />
        ) : (
          <div className="flex items-baseline gap-1 flex-wrap">
            <span className={cn('text-lg font-bold leading-tight font-mono', statusColors[status])}>
              {value}
            </span>
            {unit && <span className="text-xs font-normal text-text-secondary">{unit}</span>}
            {trend && (
              <span
                className={cn(
                  'text-[10px] font-semibold px-1 rounded ml-auto truncate',
                  trendBad
                    ? 'bg-critical/15 text-critical'
                    : 'bg-success/15 text-success'
                )}
              >
                {trend}
              </span>
            )}
          </div>
        )}
      </div>

      {(explanation || subtext) && (
        <p className="text-[10px] text-text-muted leading-tight truncate" title={explanation || subtext}>
          {explanation || subtext}
        </p>
      )}
    </div>
  );
}
