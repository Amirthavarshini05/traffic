import { useState } from 'react';
import { useTimeRange, TIME_RANGES, type TimeRangeId } from '@/context/TimeRangeContext';
import { cn } from '@/lib/utils';
import { Calendar, Clock } from 'lucide-react';

interface TimeRangeSelectorProps {
  className?: string;
  variant?: 'full' | 'compact';
}

export function TimeRangeSelector({ className, variant = 'full' }: TimeRangeSelectorProps) {
  const { range, setRange, customRange, setCustomRange } = useTimeRange();
  const [showCustom, setShowCustom] = useState(range === 'custom');

  const handleSelect = (id: TimeRangeId) => {
    if (id === 'custom') {
      setShowCustom(true);
      setRange('custom');
    } else {
      setShowCustom(false);
      setRange(id);
    }
  };

  const ranges = variant === 'compact'
    ? TIME_RANGES.filter((r) => ['1h', '6h', '24h', '7d', 'custom'].includes(r.id))
    : TIME_RANGES;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center gap-1 flex-wrap">
        <Clock className="w-3.5 h-3.5 text-text-muted shrink-0" />
        {ranges.map((r) => (
          <button
            key={r.id}
            onClick={() => handleSelect(r.id)}
            className={cn(
              'text-xs px-2.5 py-1 rounded transition-colors border',
              range === r.id
                ? 'bg-accent text-white border-accent'
                : 'text-text-secondary border-border hover:bg-bg-hover hover:text-text-primary'
            )}
          >
            {variant === 'compact' ? r.shortLabel : r.label}
          </button>
        ))}
      </div>
      {showCustom && (
        <div className="flex items-center gap-2 text-xs">
          <Calendar className="w-3.5 h-3.5 text-text-muted" />
          <input
            type="datetime-local"
            value={customRange?.from || ''}
            onChange={(e) =>
              setCustomRange({
                from: e.target.value,
                to: customRange?.to || '',
              })
            }
            className="bg-bg-elevated border border-border rounded px-2 py-1 text-text-primary focus:outline-none focus:border-accent"
          />
          <span className="text-text-muted">to</span>
          <input
            type="datetime-local"
            value={customRange?.to || ''}
            onChange={(e) =>
              setCustomRange({
                from: customRange?.from || '',
                to: e.target.value,
              })
            }
            className="bg-bg-elevated border border-border rounded px-2 py-1 text-text-primary focus:outline-none focus:border-accent"
          />
        </div>
      )}
    </div>
  );
}
