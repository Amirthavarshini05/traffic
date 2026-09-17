import { useState, useMemo, useCallback } from 'react';
import { Panel } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { MapActionButton } from '@/components/ui/MapActionButton';
import { CityTrafficMap, type MapLayerConfig } from '@/components/map/CityTrafficMap';
import { useAppData } from '@/context/AppDataContext';
import { useSelection } from '@/context/SelectionContext';
import { cn, severityBg, timeAgo } from '@/lib/utils';
import {
  Siren,
  Camera,
  Car,
  MapPin,
  Route as RouteIcon,
  ShieldAlert,
  AlertTriangle,
  Clock,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';
import type { Alert, AlertSeverity } from '@/types';
import type { PageId as NavPageId } from '@/components/layout/Sidebar';

const CATEGORIES: string[] = [
  'All',
  'Critical',
  'High',
  'Medium',
  'Camera Health',
  'Route Anomaly',
  'Abnormal Travel Time',
  'Blacklisted Vehicle',
];

const severityOrder: Record<AlertSeverity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const MAP_LAYERS: MapLayerConfig = {
  cameras: true,
  routes: true,
  incidents: true,
};

export function Alerts({ onNavigate }: { onNavigate: (p: NavPageId) => void }) {
  const { alerts } = useAppData();
  const { selection, setSelection } = useSelection();
  const [filter, setFilter] = useState<string>('All');
  const [selectedAlertId, setSelectedAlertId] = useState<string>('');

  const filtered = useMemo(() => {
    let result = [...alerts];
    if (filter === 'Critical') result = result.filter((a) => a.severity === 'CRITICAL');
    else if (filter === 'High') result = result.filter((a) => a.severity === 'HIGH');
    else if (filter === 'Medium') result = result.filter((a) => a.severity === 'MEDIUM');
    else if (filter !== 'All')
      result = result.filter((a) => a.category === filter || (a as any).alert_type === filter);
    return result.sort(
      (a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3)
    );
  }, [alerts, filter]);

  // Active investigating alert
  const currentAlert = useMemo(() => {
    if (selection?.type === 'alert' && selection.id) {
      const match = filtered.find((a) => a.alert_id === selection.id);
      if (match) return match;
    }
    if (selectedAlertId) {
      const match = filtered.find((a) => a.alert_id === selectedAlertId);
      if (match) return match;
    }
    return filtered[0] || null;
  }, [filtered, selectedAlertId, selection]);

  const handleSelectAlert = (a: Alert) => {
    setSelectedAlertId(a.alert_id);
    if (a.camera_id) {
      setSelection({
        type: 'alert',
        id: a.alert_id,
        meta: { cameraId: a.camera_id, vehicleId: a.vehicle_id },
      });
    }
  };

  return (
    <div className="flex flex-col h-full p-2 gap-2 overflow-hidden">
      {/* 1. Category Filter Bar */}
      <div className="flex items-center gap-1.5 flex-wrap shrink-0 p-1 rounded bg-surface border border-border">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={cn(
              'text-xs px-2.5 py-1 rounded transition-colors font-medium flex items-center gap-1.5',
              filter === cat
                ? 'bg-accent text-white font-semibold'
                : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
            )}
          >
            <span>{cat}</span>
            {cat === 'Critical' && <span className="w-1.5 h-1.5 rounded-full bg-critical" />}
          </button>
        ))}
        <span className="text-[11px] text-text-muted ml-auto pr-2 hidden sm:inline">
          Incident Response Console · {filtered.length} active
        </span>
      </div>

      {/* 2. Split Layout: Alert List on Left | Alert Investigation on Right */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-2 min-h-0">
        {/* Left Column: Alert List */}
        <div className="panel flex flex-col min-h-0 overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between shrink-0">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Active Alerts ({filtered.length})
            </span>
            <span className="text-[10px] text-text-muted">Click to investigate</span>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-border-subtle">
            {filtered.map((alert) => {
              const isSelected = alert.alert_id === currentAlert?.alert_id;
              return (
                <div
                  key={alert.alert_id}
                  onClick={() => handleSelectAlert(alert)}
                  className={cn(
                    'p-3 cursor-pointer transition-all border-l-2',
                    isSelected
                      ? 'bg-bg-elevated border-l-accent'
                      : 'hover:bg-bg-hover border-l-transparent'
                  )}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', severityBg(alert.severity))}>
                      {alert.severity}
                    </span>
                    <span className="text-[10px] text-text-muted font-mono">{timeAgo(alert.timestamp)}</span>
                  </div>

                  <p className="text-xs font-bold text-text-primary uppercase tracking-tight">
                    {alert.title}
                  </p>

                  <div className="flex items-center gap-2 mt-1 text-[11px] text-text-secondary font-mono">
                    {alert.vehicle_id && <span>Vehicle: {alert.vehicle_id}</span>}
                    {alert.camera_id && <span>Corridor: {alert.camera_id}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Alert Investigation Console */}
        <div className="panel flex flex-col min-h-0 overflow-hidden">
          {currentAlert ? (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Header */}
              <div className="px-4 py-2.5 border-b border-border bg-surface flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className={cn('text-xs font-bold px-2 py-0.5 rounded', severityBg(currentAlert.severity))}>
                    {currentAlert.severity}
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-text-primary uppercase leading-tight">
                      {currentAlert.title}
                    </h2>
                    <p className="text-[11px] text-text-muted">
                      Incident ID: {currentAlert.alert_id} · Authority: {currentAlert.authority || 'City Traffic Control'}
                    </p>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex items-center gap-1.5">
                  <MapActionButton
                    onClick={() => {
                      setSelection({ type: 'alert', id: currentAlert.alert_id, meta: { cameraId: currentAlert.camera_id } });
                      onNavigate('command');
                    }}
                    icon={<MapPin className="w-3 h-3" />}
                    variant="primary"
                  >
                    View on City Map
                  </MapActionButton>
                  {currentAlert.vehicle_id && (
                    <MapActionButton
                      onClick={() => {
                        setSelection({ type: 'vehicle', id: currentAlert.vehicle_id! });
                        onNavigate('vehicles');
                      }}
                      icon={<Car className="w-3 h-3" />}
                    >
                      View Vehicle
                    </MapActionButton>
                  )}
                  <MapActionButton
                    onClick={() => {
                      setSelection({ type: 'route', id: currentAlert.camera_id || 'CAM02_CAM01' });
                      onNavigate('routes');
                    }}
                    icon={<RouteIcon className="w-3 h-3" />}
                  >
                    View Route
                  </MapActionButton>
                </div>
              </div>

              {/* Body: Map & Analytical Investigation */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 p-3 min-h-0 overflow-y-auto scrollbar-thin">
                {/* Incident Location Map */}
                <div className="flex flex-col min-h-[260px] rounded-lg border border-border overflow-hidden relative">
                  <div className="px-2.5 py-1.5 bg-surface border-b border-border flex items-center justify-between text-xs font-medium shrink-0">
                    <span className="flex items-center gap-1.5 text-text-muted">
                      <MapPin className="w-3.5 h-3.5 text-accent-light" /> Incident Spatial Focus
                    </span>
                    <span className="text-[10px] text-text-muted font-mono">{currentAlert.zone || 'Metropolitan Area'}</span>
                  </div>
                  <div className="flex-1 relative">
                    <CityTrafficMap layers={MAP_LAYERS} />
                  </div>
                </div>

                {/* Empirical Evidence & Explanation */}
                <div className="flex flex-col gap-2.5 justify-between">
                  {/* Empirical Observations */}
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase font-bold text-text-muted tracking-wider">
                      Incident Observation
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2 rounded bg-bg-elevated border border-border-subtle">
                        <span className="text-[10px] text-text-muted font-sans block">Vehicle</span>
                        <span className="font-bold text-text-primary text-sm mt-0.5 block">
                          {currentAlert.vehicle_id || 'N/A'}
                        </span>
                      </div>
                      <div className="p-2 rounded bg-bg-elevated border border-border-subtle">
                        <span className="text-[10px] text-text-muted font-sans block">Corridor</span>
                        <span className="font-bold text-text-primary text-sm mt-0.5 block">
                          {currentAlert.camera_id || 'CAM02 → CAM01'}
                        </span>
                      </div>
                      <div className="p-2 rounded bg-bg-elevated border border-border-subtle">
                        <span className="text-[10px] text-text-muted font-sans block">Severity / Status</span>
                        <span className="font-bold text-critical text-sm mt-0.5 block">
                          {currentAlert.severity} ({currentAlert.status || 'ACTIVE'})
                        </span>
                      </div>
                      <div className="p-2 rounded bg-bg-elevated border border-border-subtle">
                        <span className="text-[10px] text-text-muted font-sans block">Detection Time</span>
                        <span className="font-bold text-text-primary text-sm mt-0.5 block font-mono">
                          {timeAgo(currentAlert.timestamp)}
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded bg-bg-elevated border border-border-subtle text-xs">
                      <span className="text-[10px] uppercase font-semibold text-text-muted block mb-1">
                        Surveillance Telemetry Note
                      </span>
                      <p className="text-text-secondary leading-relaxed font-sans">
                        {currentAlert.message || 'No additional telemetry message provided.'}
                      </p>
                    </div>
                  </div>

                  {/* Micro-Explanation: WHAT DOES THIS MEAN? */}
                  <div className="p-3 rounded bg-accent/10 border border-accent/25 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-accent-light text-xs font-bold">
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Incident Interpretation</span>
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      {currentAlert.message
                        ? `Operational intelligence confirms anomaly: ${currentAlert.message}`
                        : 'Explanation unavailable from current backend inference pipeline.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              title="No alert selected"
              message="Select an alert from the left panel to begin spatial investigation."
              icon={<Siren className="w-5 h-5" />}
            />
          )}
        </div>
      </div>
    </div>
  );
}
