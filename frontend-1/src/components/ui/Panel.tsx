import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PanelProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  noPadding?: boolean;
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
  noPadding,
}: PanelProps) {
  return (
    <div className={cn('panel', className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <div className="min-w-0">
            {title && (
              <h3 className="text-sm font-semibold text-text-primary tracking-wide truncate">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-text-muted mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      <div className={cn(!noPadding && 'p-4', bodyClassName)}>{children}</div>
    </div>
  );
}
