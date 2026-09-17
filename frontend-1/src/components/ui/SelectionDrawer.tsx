import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface SelectionDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  side?: 'right' | 'bottom';
}

export function SelectionDrawer({
  open,
  onClose,
  title,
  subtitle,
  actions,
  children,
  side = 'right',
}: SelectionDrawerProps) {
  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
      />
      <div
        className={cn(
          'fixed z-50 panel shadow-lg animate-slide-in-right overflow-y-auto scrollbar-thin',
          side === 'right'
            ? 'right-0 top-0 h-full w-96 max-w-[90vw]'
            : 'left-0 right-0 bottom-0 max-h-[60vh] rounded-b-none'
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-surface z-10">
          <div className="min-w-0">
            {title && (
              <h3 className="text-sm font-semibold text-text-primary truncate">{title}</h3>
            )}
            {subtitle && (
              <p className="text-xs text-text-muted truncate">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {actions}
            <button
              onClick={onClose}
              className="text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </>
  );
}
