import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type SelectionType = 'camera' | 'route' | 'zone' | 'vehicle' | 'alert' | null;

export interface Selection {
  type: SelectionType;
  id: string;
  label?: string;
  meta?: Record<string, unknown>;
}

interface SelectionContextValue {
  selection: Selection | null;
  setSelection: (s: Selection | null) => void;
  clearSelection: () => void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selection, setSelectionState] = useState<Selection | null>(null);

  const setSelection = useCallback((s: Selection | null) => setSelectionState(s), []);
  const clearSelection = useCallback(() => setSelectionState(null), []);

  return (
    <SelectionContext.Provider value={{ selection, setSelection, clearSelection }}>
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useSelection must be used within SelectionProvider');
  return ctx;
}
