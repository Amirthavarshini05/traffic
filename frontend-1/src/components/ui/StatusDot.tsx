import { cn } from '@/lib/utils';

interface StatusDotProps {
  color: 'green' | 'amber' | 'red' | 'gray';
  pulse?: boolean;
  size?: 'sm' | 'md';
}

const colorMap: Record<string, string> = {
  green: 'bg-success',
  amber: 'bg-warning',
  red: 'bg-critical',
  gray: 'bg-text-muted',
};

export function StatusDot({ color, pulse, size = 'sm' }: StatusDotProps) {
  return (
    <span className="relative inline-flex">
      <span
        className={cn(
          'rounded-full',
          colorMap[color],
          size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'
        )}
      />
      {pulse && (
        <span
          className={cn(
            'absolute inset-0 rounded-full animate-ping-slow opacity-60',
            colorMap[color]
          )}
        />
      )}
    </span>
  );
}
