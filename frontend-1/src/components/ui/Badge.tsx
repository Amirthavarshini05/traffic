import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps {
  children: ReactNode;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'gray';
  size?: 'sm' | 'md';
  pulse?: boolean;
  className?: string;
}

const colorMap: Record<string, string> = {
  blue: 'bg-accent/15 text-accent-light border-accent/30',
  green: 'bg-success/15 text-success border-success/30',
  amber: 'bg-warning/15 text-warning border-warning/30',
  red: 'bg-critical/15 text-critical border-critical/30',
  gray: 'bg-bg-elevated text-text-secondary border-border',
};

export function Badge({ children, color = 'gray', size = 'sm', pulse, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border font-medium',
        colorMap[color],
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs',
        pulse && 'animate-pulse-slow',
        className
      )}
    >
      {children}
    </span>
  );
}
