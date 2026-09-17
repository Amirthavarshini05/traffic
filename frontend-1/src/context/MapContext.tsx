import { createContext, useContext, type ReactNode } from 'react';

const MapContext = createContext<null>(null);

export function MapProvider({ children }: { children: ReactNode }) {
  return <MapContext.Provider value={null}>{children}</MapContext.Provider>;
}

export function useMapContext() {
  return useContext(MapContext);
}
