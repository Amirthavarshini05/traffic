import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type TimeRangeId = '1h' | '6h' | '24h' | '1d' | '7d' | '30d' | '3m' | 'custom';

export interface TimeRange {
  id: TimeRangeId;
  label: string;
  shortLabel: string;
}

export interface CustomRange {
  from: string;
  to: string;
}

export const TIME_RANGES: TimeRange[] = [
  { id: '1h', label: 'Last 1 hour', shortLabel: '1H' },
  { id: '6h', label: 'Last 6 hours', shortLabel: '6H' },
  { id: '24h', label: 'Last 24 hours', shortLabel: '24H' },
  { id: '1d', label: 'Last 1 day', shortLabel: '1D' },
  { id: '7d', label: 'Last 7 days', shortLabel: '7D' },
  { id: '30d', label: 'Last 30 days', shortLabel: '30D' },
  { id: '3m', label: 'Last 3 months', shortLabel: '3M' },
  { id: 'custom', label: 'Custom range', shortLabel: 'Custom' },
];

interface TimeRangeContextValue {
  range: TimeRangeId;
  setRange: (r: TimeRangeId) => void;
  customRange: CustomRange | null;
  setCustomRange: (r: CustomRange | null) => void;
  apiParam: string;
  startTime: string;
  endTime: string;
}

const TimeRangeContext = createContext<TimeRangeContextValue | null>(null);

function computeIsoWindow(range: TimeRangeId, custom: CustomRange | null): { startTime: string; endTime: string } {
  if (range === 'custom' && custom && custom.from && custom.to) {
    try {
      return {
        startTime: new Date(custom.from).toISOString(),
        endTime: new Date(custom.to).toISOString(),
      };
    } catch {
      // Fallback if invalid date
    }
  }
  const now = new Date();
  let ms = 24 * 60 * 60 * 1000;
  switch (range) {
    case '1h': ms = 1 * 60 * 60 * 1000; break;
    case '6h': ms = 6 * 60 * 60 * 1000; break;
    case '24h':
    case '1d': ms = 24 * 60 * 60 * 1000; break;
    case '7d': ms = 7 * 24 * 60 * 60 * 1000; break;
    case '30d': ms = 30 * 24 * 60 * 60 * 1000; break;
    case '3m': ms = 90 * 24 * 60 * 60 * 1000; break;
    default: ms = 24 * 60 * 60 * 1000; break;
  }
  return {
    startTime: new Date(now.getTime() - ms).toISOString(),
    endTime: now.toISOString(),
  };
}

function buildApiParam(range: TimeRangeId, custom: CustomRange | null): string {
  if (range === 'custom' && custom) {
    return `from=${encodeURIComponent(custom.from)}&to=${encodeURIComponent(custom.to)}`;
  }
  const map: Record<TimeRangeId, string> = {
    '1h': 'range=1h',
    '6h': 'range=6h',
    '24h': 'range=24h',
    '1d': 'range=1d',
    '7d': 'range=7d',
    '30d': 'range=30d',
    '3m': 'range=3m',
    custom: '',
  };
  return map[range] || '';
}

export function TimeRangeProvider({ children }: { children: ReactNode }) {
  const [range, setRangeState] = useState<TimeRangeId>('1h');
  const [customRange, setCustomRange] = useState<CustomRange | null>(null);

  const setRange = useCallback((r: TimeRangeId) => setRangeState(r), []);
  const apiParam = buildApiParam(range, customRange);
  const { startTime, endTime } = computeIsoWindow(range, customRange);

  return (
    <TimeRangeContext.Provider
      value={{ range, setRange, customRange, setCustomRange, apiParam, startTime, endTime }}
    >
      {children}
    </TimeRangeContext.Provider>
  );
}

export function useTimeRange() {
  const ctx = useContext(TimeRangeContext);
  if (!ctx) throw new Error('useTimeRange must be used within TimeRangeProvider');
  return ctx;
}
