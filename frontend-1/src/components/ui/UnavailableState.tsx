import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface UnavailableStateProps {
  title: string;
  message: string;
  action?: ReactNode;
  icon?: ReactNode;
  compact?: boolean;
}

export function UnavailableState({
  title,
  message,
  action,
  icon,
  compact,
}: UnavailableStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-4 px-3' : 'py-6 px-4'
      )}
    >
      {icon && (
        <div className={cn('text-text-muted mb-2', compact ? 'opacity-60' : 'opacity-40')}>
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-text-secondary">{title}</p>
      <p className="text-xs text-text-muted mt-1 max-w-sm leading-relaxed">{message}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
