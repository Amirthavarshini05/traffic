import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EvidenceItem {
  label: string;
  value: string;
  weight?: 'primary' | 'secondary' | 'minor';
}

interface ExplanationPanelProps {
  title?: string;
  evidence: EvidenceItem[];
  interpretation?: string;
  whatDoesThisMean?: string;
  disclaimer?: string;
  children?: ReactNode;
  className?: string;
}

export function ExplanationPanel({
  title = 'Why Is This Area Congested?',
  evidence,
  interpretation,
  whatDoesThisMean,
  disclaimer,
  children,
  className,
}: ExplanationPanelProps) {
  const weightColor = (w?: string) => {
    switch (w) {
      case 'primary': return 'text-critical';
      case 'secondary': return 'text-warning';
      default: return 'text-text-secondary';
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      <p className="text-sm font-semibold text-text-primary">{title}</p>

      {evidence.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Contributing Factors</p>
          {evidence.map((e, i) => (
            <div key={i} className="flex items-center justify-between py-1 px-2 rounded bg-bg-elevated">
              <span className="text-xs text-text-secondary">{e.label}</span>
              <span className={cn('text-xs font-medium', weightColor(e.weight))}>{e.value}</span>
            </div>
          ))}
        </div>
      )}

      {children}

      {interpretation && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-1">Interpretation</p>
          <p className="text-xs text-text-secondary leading-relaxed">{interpretation}</p>
        </div>
      )}

      {whatDoesThisMean && (
        <div className="pt-2 border-t border-border-subtle">
          <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-1">What Does This Mean?</p>
          <p className="text-xs text-text-muted leading-relaxed">{whatDoesThisMean}</p>
        </div>
      )}

      {disclaimer && (
        <p className="text-[10px] text-text-muted italic leading-relaxed pt-1">{disclaimer}</p>
      )}
    </div>
  );
}
