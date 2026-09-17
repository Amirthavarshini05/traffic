import { cn } from '@/lib/utils';
import type { MapLayerConfig } from '@/components/map/CityTrafficMap';

interface MapLegendProps {
  layers: MapLayerConfig;
  className?: string;
}

interface LegendEntry {
  type: 'line' | 'point';
  label: string;
  color: string;
  tooltip: string;
}

export function MapLegend({ layers, className }: MapLegendProps) {
  const activeItems: LegendEntry[] = [];

  // Route / Corridor congestion
  if (layers.congestion || layers.trafficDensity || layers.routes) {
    activeItems.push({
      type: 'line',
      label: 'Corridor - Clear',
      color: '#10B981',
      tooltip: 'Normal free flow (>35 km/h, no delay)',
    });
    activeItems.push({
      type: 'line',
      label: 'Corridor - Moderate',
      color: '#F59E0B',
      tooltip: 'Moderate congestion (15-35% travel time delay)',
    });
    activeItems.push({
      type: 'line',
      label: 'Corridor - Heavy',
      color: '#EF4444',
      tooltip: 'Severe congestion (>35% delay, queue buildup)',
    });
  }

  // OD Flow routes
  if (layers.odFlow) {
    activeItems.push({
      type: 'line',
      label: 'Active OD Corridor',
      color: '#38BDF8',
      tooltip: 'Selected corridor with directional traffic flow',
    });
    activeItems.push({
      type: 'point',
      label: 'Origin (O) / Dest (D)',
      color: '#10B981',
      tooltip: 'Origin node (green O) and Destination node (amber D)',
    });
  }

  // Camera surveillance nodes
  if (layers.cameras || layers.cameraHealth) {
    activeItems.push({
      type: 'point',
      label: 'Camera - Healthy',
      color: '#10B981',
      tooltip: 'Camera online and streaming ANPR detections',
    });
    activeItems.push({
      type: 'point',
      label: 'Camera - Warning',
      color: '#F59E0B',
      tooltip: 'Camera experiencing frame drops or latency',
    });
    activeItems.push({
      type: 'point',
      label: 'Camera - Offline',
      color: '#EF4444',
      tooltip: 'Surveillance node disconnected',
    });
  }

  // Incidents
  if (layers.incidents) {
    activeItems.push({
      type: 'point',
      label: 'Active Incident',
      color: '#EF4444',
      tooltip: 'Traffic collision, congestion anomaly, or stopped vehicle',
    });
  }

  // Vehicle Trajectory
  if (layers.trajectory) {
    activeItems.push({
      type: 'line',
      label: 'Vehicle Trajectory',
      color: '#A855F7',
      tooltip: 'Chronological path reconstructed from camera detections',
    });
  }

  if (activeItems.length === 0) return null;

  return (
    <div className={cn('absolute bottom-3 left-3 z-10 panel px-2.5 py-2 backdrop-blur-md bg-surface/90 border border-border/80 shadow-lg select-none', className)}>
      <div className="flex items-center justify-between gap-2 mb-1.5 border-b border-border/50 pb-1">
        <p className="text-[10px] uppercase tracking-wider text-text-muted font-bold">Map Legend</p>
        <span className="text-[9px] text-text-muted">Hover for info</span>
      </div>
      <div className="space-y-1.5">
        {activeItems.map((item, i) => (
          <div
            key={i}
            title={`${item.label}: ${item.tooltip}`}
            className="flex items-center gap-2 group cursor-help py-0.5 px-1 -mx-1 rounded hover:bg-bg-hover/60 transition-colors"
          >
            {item.type === 'line' ? (
              <span
                className="w-4 h-1.5 rounded-full shrink-0 shadow-sm transition-transform group-hover:scale-110"
                style={{ backgroundColor: item.color }}
              />
            ) : (
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm transition-transform group-hover:scale-125"
                style={{ backgroundColor: item.color }}
              />
            )}
            <span className="text-[11px] text-text-secondary group-hover:text-text-primary transition-colors font-medium">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

