import type { CongestionLevel, AlertSeverity, CameraHealth } from '@/types';

export function formatNumber(n: number | undefined | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return 'N/A';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function formatSpeed(n: number | undefined | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return 'N/A';
  return `${n.toFixed(1)} km/h`;
}

export function formatTime(seconds: number | undefined | null): string {
  if (seconds === undefined || seconds === null || Number.isNaN(seconds))
    return 'N/A';
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

export function formatDateTime(iso: string | undefined | null): string {
  if (!iso) return 'N/A';
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return 'N/A';
  }
}

export function formatTimeShort(iso: string | undefined | null): string {
  if (!iso) return 'N/A';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return 'N/A';
  }
}

export function timeAgo(iso: string | undefined | null): string {
  if (!iso) return 'N/A';
  try {
    const d = new Date(iso).getTime();
    const now = Date.now();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 0) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return 'N/A';
  }
}

export function congestionBg(level: CongestionLevel | undefined): string {
  switch (level) {
    case 'NONE':
      return 'bg-success/15 text-success';
    case 'LOW':
      return 'bg-success/15 text-success';
    case 'MODERATE':
      return 'bg-warning/15 text-warning';
    case 'HIGH':
      return 'bg-warning/20 text-warning';
    case 'SEVERE':
      return 'bg-critical/15 text-critical';
    default:
      return 'bg-bg-elevated text-text-muted';
  }
}

export function severityBg(severity: AlertSeverity | undefined): string {
  switch (severity) {
    case 'CRITICAL':
      return 'bg-critical/15 text-critical';
    case 'HIGH':
      return 'bg-warning/15 text-warning';
    case 'MEDIUM':
      return 'bg-accent/15 text-accent-light';
    case 'LOW':
      return 'bg-bg-elevated text-text-muted';
    default:
      return 'bg-bg-elevated text-text-muted';
  }
}

export function healthBg(status: CameraHealth | undefined): string {
  switch (status) {
    case 'HEALTHY':
      return 'bg-success/15 text-success';
    case 'WARNING':
      return 'bg-warning/15 text-warning';
    case 'OFFLINE':
      return 'bg-critical/15 text-critical';
    default:
      return 'bg-bg-elevated text-text-muted';
  }
}

export function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function computeDelta(
  current: number | undefined,
  baseline: number | undefined
): { pct: number | null; direction: 'up' | 'down' | 'flat' | null } {
  if (current == null || baseline == null || baseline === 0)
    return { pct: null, direction: null };
  const pct = ((current - baseline) / baseline) * 100;
  const direction = Math.abs(pct) < 1 ? 'flat' : pct > 0 ? 'up' : 'down';
  return { pct, direction };
}

export function deltaColor(
  direction: 'up' | 'down' | 'flat' | null,
  higherIsBad: boolean
): string {
  if (!direction) return 'text-text-muted';
  if (direction === 'flat') return 'text-text-muted';
  if (higherIsBad) {
    return direction === 'up' ? 'text-critical' : 'text-success';
  }
  return direction === 'up' ? 'text-success' : 'text-critical';
}

export function deltaArrow(direction: 'up' | 'down' | 'flat' | null): string {
  if (!direction) return '';
  if (direction === 'flat') return '→';
  return direction === 'up' ? '↑' : '↓';
}

export function interpretDelta(
  pct: number | null,
  direction: 'up' | 'down' | 'flat' | null,
  higherIsBad: boolean,
  metricName: string
): string {
  if (pct == null || !direction)
    return `Comparison with historical baseline is not available for ${metricName.toLowerCase()}.`;
  const sign = direction === 'up' ? '+' : '';
  const absPct = Math.abs(pct);
  let severity = '';
  if (absPct < 10) severity = 'slightly';
  else if (absPct < 30) severity = 'moderately';
  else if (absPct < 60) severity = 'significantly';
  else severity = 'dramatically';

  if (higherIsBad) {
    if (direction === 'up') {
      return `${metricName} is ${severity} higher than the historical baseline (${sign}${pct.toFixed(0)}%). This may indicate worsening conditions.`;
    }
    return `${metricName} is ${severity} lower than the historical baseline (${pct.toFixed(0)}%). Conditions are better than expected.`;
  }
  if (direction === 'up') {
    return `${metricName} is ${severity} higher than the historical baseline (${sign}${pct.toFixed(0)}%). Conditions are better than expected.`;
  }
  return `${metricName} is ${severity} lower than the historical baseline (${pct.toFixed(0)}%). This may indicate reduced activity.`;
}
