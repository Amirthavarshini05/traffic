interface MetricWithInterpretationProps {
  label: string;
  value: string;
  unit?: string;
  interpretation?: string;
  microtext?: string;
  loading?: boolean;
}

export function MetricWithInterpretation({
  label,
  value,
  unit,
  interpretation,
  microtext,
  loading,
}: MetricWithInterpretationProps) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] uppercase tracking-wider text-text-muted font-medium">{label}</p>
      {loading ? (
        <div className="h-5 w-20 bg-bg-elevated rounded animate-pulse" />
      ) : (
        <p className="text-base font-semibold text-text-primary">
          {value}
          {unit && <span className="text-xs font-normal text-text-secondary ml-1">{unit}</span>}
        </p>
      )}
      {interpretation && (
        <p className="text-[11px] text-text-secondary leading-relaxed">{interpretation}</p>
      )}
      {microtext && (
        <p className="text-[10px] text-text-muted leading-relaxed">{microtext}</p>
      )}
    </div>
  );
}
