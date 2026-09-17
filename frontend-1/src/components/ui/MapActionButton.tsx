import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MapActionButtonProps {
  onClick: () => void;
  icon?: ReactNode;
  children: ReactNode;
  variant?: 'primary' | 'ghost';
  className?: string;
}

export function MapActionButton({
  onClick,
  icon,
  children,
  variant = 'ghost',
  className,
}: MapActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors',
        variant === 'primary'
          ? 'bg-accent text-white hover:bg-accent-dim'
          : 'bg-bg-elevated text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-border',
        className
      )}
    >
      {icon}
      {children}
    </button>
  );
}
