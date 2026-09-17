import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: ReactNode;
}

export function EmptyState({ title, message, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      {icon && <div className="text-text-muted mb-2">{icon}</div>}
      <p className="text-sm font-medium text-text-secondary">{title}</p>
      {message && <p className="text-xs text-text-muted mt-1">{message}</p>}
    </div>
  );
}
