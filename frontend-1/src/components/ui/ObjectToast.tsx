import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ObjectToastProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  status?: { label: string; color: 'green' | 'amber' | 'red' | 'gray' | 'blue' };
  actions?: ReactNode;
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
}

const positionClasses: Record<string, string> = {
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
};

const statusColors: Record<string, string> = {
  green: 'bg-success/15 text-success',
  amber: 'bg-warning/15 text-warning',
  red: 'bg-critical/15 text-critical',
  gray: 'bg-bg-elevated text-text-muted',
  blue: 'bg-accent/15 text-accent-light',
};

export function ObjectToast({
  visible,
  title,
  subtitle,
  status,
  actions,
  position = 'bottom-left',
}: ObjectToastProps) {
  if (!visible) return null;

  return (
    <div
      className={cn(
        'absolute z-20 panel px-3 py-2.5 min-w-48 max-w-64 animate-fade-in',
        positionClasses[position]
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-sm font-semibold text-text-primary">{title}</span>
        {status && (
          <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', statusColors[status.color])}>
            {status.label}
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs text-text-muted mb-2">{subtitle}</p>}
      {actions && <div className="flex items-center gap-2 mt-1">{actions}</div>}
    </div>
  );
}
