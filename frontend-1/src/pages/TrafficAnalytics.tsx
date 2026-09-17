import { useRef, useMemo, useState, useCallback } from 'react';
import { CityTrafficMap, type CityTrafficMapHandle, type MapLayerConfig } from '@/components/map/CityTrafficMap';
import { MapLegend } from '@/components/map/MapLegend';
import { Panel } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/Badge';
import { TimeRangeSelector } from '@/components/ui/TimeRangeSelector';
import { useAppData } from '@/context/AppDataContext';
import { useSelection } from '@/context/SelectionContext';
import { formatNumber, formatSpeed, formatTime, cn } from '@/lib/utils';
import {
  Car,
  Gauge,
  AlertTriangle,
  MapPin,
  Brain,
  GitBranch,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Clock,
  HelpCircle,
  Route as RouteIcon,
} from 'lucide-react';
import type { PageId } from '@/components/layout/Sidebar';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

const MAP_LAYERS: MapLayerConfig = {
  cameras: true,
  cameraHealth: true,
  routes: true,
  congestion: true,
  trafficDensity: true,
};

type SubTab = 'why' | 'propagation' | 'prediction' | 'rerouting';

export function TrafficAnalytics({ onNavigate }: { onNavigate?: (p: PageId) => void }) {
  const mapRef = useRef<CityTrafficMapHandle>(null);
  const { summary, congestionHistory, propagation, routeAnalytics, zoneTraffic, cameras, loading } = useAppData();
  const { selection, setSelection, clearSelection } = useSelection();
  const [activeTab, setActiveTab] = useState<SubTab>('why');

  const routes = routeAnalytics?.routes ?? [];
  const zones = zoneTraffic?.zones ?? [];

  const handleCameraClick = useCallback(
    (cameraId: string) => setSelection({ type: 'camera', id: cameraId }),
    [setSelection]
  );
  const handleRouteClick = useCallback(
    (routeId: string) => setSelection({ type: 'route', id: routeId }),
    [setSelection]
  );
  const handleMapClick = useCallback(() => clearSelection(), [clearSelection]);

  // Selected route data from real API
  const selectedRoute = useMemo(() => {
    if (selection?.type !== 'route') return null;
    return routes.find(
      (r) => r.route_id === selection.id || `${r.from_camera_id}_${r.to_camera_id}` === selection.id
    ) || null;
  }, [selection, routes]);

  // Selected camera from real API
  const selectedCamera = useMemo(() => {
    if (selection?.type !== 'camera') return null;
    return cameras.find((c) => c.camera_id === selection.id) || null;
  }, [selection, cameras]);

  // Selected zone from real API
  const selectedZoneData = useMemo(() => {
    if (selection?.type === 'zone') {
      return zones.find((z) => z.zone?.toLowerCase() === selection.id.toLowerCase()) || null;
    }
    if (selectedCamera?.zone) {
      return zones.find((z) => z.zone?.toLowerCase() === selectedCamera.zone?.toLowerCase()) || null;
    }
    return zones[0] || null;
  }, [selection, selectedCamera, zones]);

  const activeEntityName = selectedRoute
    ? (selectedRoute.route_name || `${selectedRoute.from_camera_id} → ${selectedRoute.to_camera_id}`)
    : selectedCamera
    ? `${selectedCamera.camera_id} (${selectedCamera.name || selectedCamera.zone || 'Camera'})`
    : selectedZoneData
    ? (selectedZoneData.zone || 'Metropolitan Zone')
    : 'All Corridors';

  // Real chart data from /analytics/congestion/history
  const chartData = useMemo(() => {
    if (!congestionHistory?.records?.length) return [];
    return congestionHistory.records.map((r) => ({
      time: r.timestamp ? new Date(r.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
      delayPct: r.delay_pct ?? 0,
      vehicles: r.vehicle_count ?? 0,
    }));
  }, [congestionHistory]);

  // Real propagation records from /analytics/congestion/propagation
  const propagationRecords = propagation?.records ?? [];

  const handlePropagationClick = (p: typeof propagationRecords[0]) => {
    if (p.downstream_route) {
      const parts = p.downstream_route.split('→').map((s) => s.trim());
      if (parts.length === 2) {
        setSelection({ type: 'route', id: `${parts[0]}_${parts[1]}` });
        return;
      }
    }
    if (p.to_camera_id) {
      setSelection({ type: 'camera', id: p.to_camera_id });
    }
  };

  return (
    <div className="flex flex-col h-full gap-2 p-2 overflow-hidden">
      {/* 1. Top Controls Bar: Time Selector + Zone/Camera Selection + Operational Overview */}
      <div className="flex items-center justify-between gap-2 p-1.5 rounded bg-surface border border-border shrink-0 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs">
            <Clock className="w-3.5 h-3.5 text-accent-light" />
            <span className="text-text-muted font-medium">Horizon:</span>
            <TimeRangeSelector variant="full" />
          </div>

          <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

          {/* Zone Selector */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-text-muted font-medium">Zone:</span>
            <select
              value={selection?.type === 'zone' ? selection.id : ''}
              onChange={(e) => {
                if (e.target.value) {
                  setSelection({ type: 'zone', id: e.target.value });
                } else {
                  clearSelection();
                }
              }}
              className="px-2 py-1 rounded bg-bg-elevated border border-border text-xs text-text-primary focus:outline-none focus:border-accent cursor-pointer"
            >
              <option value="">All Zones (Citywide)</option>
              {zones.map((z) => (
                <option key={z.zone} value={z.zone}>
                  {z.zone} {z.vehicle_count != null ? `(${formatNumber(z.vehicle_count)} veh)` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Camera Point Selector */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-text-muted font-medium">Camera Point:</span>
            <select
              value={selection?.type === 'camera' ? selection.id : ''}
              onChange={(e) => {
                if (e.target.value) {
                  setSelection({ type: 'camera', id: e.target.value });
                } else {
                  clearSelection();
                }
              }}
              className="px-2 py-1 rounded bg-bg-elevated border border-border font-mono text-xs text-text-primary focus:outline-none focus:border-accent cursor-pointer max-w-[200px] truncate"
            >
              <option value="">All Camera Points</option>
              {cameras.map((c) => (
                <option key={c.camera_id} value={c.camera_id}>
                  {c.camera_id} - {c.name || c.zone}
                </option>
              ))}
            </select>
          </div>

          {selection && (
            <button
              onClick={clearSelection}
              className="px-2 py-0.5 rounded text-[11px] bg-bg-elevated hover:bg-bg-hover text-text-muted hover:text-text-primary border border-border transition-colors flex items-center gap-1"
              title="Reset focus to entire city"
            >
              <span>✕</span>
              <span>Reset Filter</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-text-muted">Network Speed:</span>
            <span className="font-mono font-semibold text-text-primary">
              {summary.avg_speed != null ? `${summary.avg_speed.toFixed(1)} km/h` : 'Unavailable'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-text-muted">Active Corridors:</span>
            <span className="font-mono font-semibold text-accent-light">
              {routes.length} monitored
            </span>
          </div>
        </div>
      </div>

      {/* 2. Main Area: Congestion Map (Primary) + Contextual Right Analysis Panel */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-2 min-h-0">
        {/* Congestion Map */}
        <div className="panel relative overflow-hidden min-h-0 flex flex-col">
          <div className="flex-1 relative">
            <CityTrafficMap
              ref={mapRef}
              layers={MAP_LAYERS}
              routeAnalytics={routes}
              onCameraClick={handleCameraClick}
              onRouteClick={handleRouteClick}
              onMapClick={handleMapClick}
            />
            <MapLegend layers={MAP_LAYERS} />
          </div>

          <div className="h-7 px-3 bg-surface/90 border-t border-border flex items-center justify-between text-[11px] text-text-muted z-10 shrink-0">
            <span>
              Active Context: <span className="font-medium text-text-primary">{activeEntityName}</span>
            </span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-success inline-block" /> Low congestion
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-warning inline-block" /> Moderate
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-critical inline-block" /> High congestion
              </span>
            </div>
          </div>
        </div>

        {/* Contextual Intelligence Side Panel */}
        <div className="flex flex-col gap-2 min-h-0 overflow-y-auto scrollbar-thin">
          {/* Selected Context Metrics */}
          <Panel
            title={activeEntityName.toUpperCase()}
            subtitle="Contextual Traffic Intelligence"
            actions={
              selection ? (
                <button onClick={clearSelection} className="text-[11px] text-text-muted hover:text-text-primary underline">
                  Clear
                </button>
              ) : undefined
            }
          >
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="p-2 rounded bg-bg-elevated border border-border-subtle">
                <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Congestion</p>
                <p className={cn(
                  'text-base font-bold mt-0.5',
                  (selectedRoute?.congestion_level === 'HIGH' || selectedZoneData?.congestion_level === 'HIGH')
                    ? 'text-critical'
                    : 'text-warning'
                )}>
                  {selectedRoute?.congestion_level || selectedZoneData?.congestion_level || 'Normal'}
                </p>
              </div>

              <div className="p-2 rounded bg-bg-elevated border border-border-subtle">
                <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Vehicle Density</p>
                <p className="text-base font-bold font-mono text-text-primary mt-0.5">
                  {selectedRoute?.vehicle_count != null
                    ? selectedRoute.vehicle_count
                    : selectedZoneData?.vehicle_count != null
                    ? selectedZoneData.vehicle_count
                    : 'Unavailable'}
                </p>
              </div>

              <div className="p-2 rounded bg-bg-elevated border border-border-subtle">
                <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Avg Travel Time</p>
                <p className="text-sm font-semibold font-mono text-text-primary mt-0.5">
                  {selectedRoute?.avg_travel_time != null ? `${Math.round(selectedRoute.avg_travel_time)}s` : 'Unavailable'}
                </p>
                <p className="text-[9px] text-text-muted">
                  Baseline: {selectedRoute?.baseline_travel_time != null ? `${selectedRoute.baseline_travel_time}s` : 'Historical baseline'}
                </p>
              </div>

              <div className="p-2 rounded bg-bg-elevated border border-border-subtle">
                <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Delay vs Expected</p>
                <p className={cn(
                  'text-sm font-bold font-mono mt-0.5',
                  selectedRoute?.delay ? 'text-critical' : 'text-text-secondary'
                )}>
                  {selectedRoute?.delay != null && selectedRoute.delay > 0 ? `+${Math.round(selectedRoute.delay)}s` : 'Unavailable'}
                </p>
                <p className="text-[9px] text-text-muted">Corridor travel deviation</p>
              </div>
            </div>

            {/* Micro-Explanation: WHAT DOES THIS MEAN? */}
            <div className="p-2.5 rounded bg-accent/10 border border-accent/25 space-y-1">
              <div className="flex items-center gap-1.5 text-accent-light text-xs font-semibold">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>What does this mean?</span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                {selectedRoute?.delay && selectedRoute.delay > 30
                  ? 'Vehicles are currently taking longer than the historical expected travel time through this corridor.'
                  : 'Corridor travel time and vehicle volumes are operating within historical baseline parameters.'}
              </p>
            </div>

            {/* Quick action to navigate to Route & OD page */}
            {selectedRoute && onNavigate && (
              <div className="pt-2">
                <button
                  onClick={() => onNavigate('routes')}
                  className="w-full py-1.5 px-3 rounded bg-accent/15 hover:bg-accent/25 text-accent-light text-xs font-semibold border border-accent/30 flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <RouteIcon className="w-3.5 h-3.5" />
                  <span>Open in Route & OD Matrix →</span>
                </button>
              </div>
            )}
          </Panel>

          {/* Sub-Tabs: Why? | Propagation | Prediction | Recommendation */}
          <div className="flex items-center gap-1 p-1 rounded bg-surface border border-border">
            {(['why', 'propagation', 'prediction', 'rerouting'] as SubTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex-1 py-1 px-1.5 text-xs font-medium rounded transition-colors capitalize text-center',
                  activeTab === tab
                    ? 'bg-accent text-white font-semibold'
                    : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
                )}
              >
                {tab === 'why' ? 'Why?' : tab === 'rerouting' ? 'Response' : tab}
              </button>
            ))}
          </div>

          {/* Sub-Tab 1: Why? (Cause Analysis: Evidence vs Interpretation) */}
          {activeTab === 'why' && (
            <Panel title="CAUSE ANALYSIS">
              <div className="space-y-3">
                {/* Observed Evidence */}
                <div>
                  <p className="text-[10px] uppercase font-bold text-text-muted tracking-wider mb-1.5">
                    Observed Evidence
                  </p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between p-2 rounded bg-bg-elevated text-xs border border-border-subtle">
                      <span className="text-text-secondary">Vehicle Volume</span>
                      <span className="font-bold text-text-primary">
                        {selectedRoute?.vehicle_count != null ? `${selectedRoute.vehicle_count} vehicles` : selectedZoneData?.vehicle_count != null ? `${selectedZoneData.vehicle_count} vehicles` : 'Unavailable'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-bg-elevated text-xs border border-border-subtle">
                      <span className="text-text-secondary">Travel Time</span>
                      <span className="font-bold text-text-primary">
                        {selectedRoute?.avg_travel_time != null ? `${Math.round(selectedRoute.avg_travel_time)}s` : 'Unavailable'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-bg-elevated text-xs border border-border-subtle">
                      <span className="text-text-secondary">Corridor Load</span>
                      <span className="font-bold text-text-primary">
                        {selectedRoute?.trajectory_count != null ? `${selectedRoute.trajectory_count} trajectories` : 'Unavailable'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* System Interpretation */}
                <div className="pt-2 border-t border-border-subtle">
                  <p className="text-[10px] uppercase font-bold text-text-muted tracking-wider mb-1">
                    System Interpretation
                  </p>
                  <div className="p-2.5 rounded bg-surface border border-border-subtle text-xs text-text-secondary leading-relaxed">
                    {selectedRoute?.delay && selectedRoute.delay > 30
                      ? 'Traffic volume has increased along this corridor, causing travel times to rise above baseline levels.'
                      : 'Travel times and flow rates remain consistent with historical surveillance observations.'}
                  </div>
                </div>
              </div>
            </Panel>
          )}

          {/* Sub-Tab 2: Propagation */}
          {activeTab === 'propagation' && (
            <Panel title="CONGESTION PROPAGATION" subtitle="Downstream spillover analysis">
              {propagationRecords.length === 0 ? (
                <div className="p-4 rounded bg-bg-elevated border border-border-subtle text-center space-y-1 text-xs">
                  <GitBranch className="w-5 h-5 text-text-muted mx-auto opacity-50" />
                  <p className="font-semibold text-text-primary">No active propagation detected</p>
                  <p className="text-text-muted">
                    When congestion spreads downstream, the detected corridor chain and impact horizon will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {propagationRecords.map((p, i) => (
                    <div
                      key={i}
                      onClick={() => handlePropagationClick(p)}
                      className="p-2.5 rounded bg-bg-elevated hover:bg-bg-hover cursor-pointer border border-border-subtle transition-all flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-text-primary font-mono">{p.source_route || `${p.from_camera_id} → ${p.to_camera_id}`}</p>
                        <p className="text-[10px] text-text-muted">Downstream: {p.downstream_route}</p>
                      </div>
                      <div className="text-right">
                        {p.probability != null && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-warning/15 text-warning block">
                            {(p.probability * 100).toFixed(0)}% probability
                          </span>
                        )}
                        {p.estimated_impact && <span className="text-[9px] text-text-muted">{p.estimated_impact}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          )}

          {/* Sub-Tab 3: Prediction (Explicit Unavailable State) */}
          {activeTab === 'prediction' && (
            <Panel title="PREDICTED CONGESTION" actions={<Brain className="w-4 h-4 text-text-muted" />}>
              <div className="p-4 rounded bg-bg-elevated border border-border-subtle text-center space-y-2">
                <Brain className="w-7 h-7 text-text-muted mx-auto opacity-50" />
                <p className="text-sm font-semibold text-text-primary">Prediction unavailable</p>
                <p className="text-xs text-text-secondary leading-relaxed max-w-xs mx-auto">
                  Historical and current traffic intelligence remain available.
                </p>
              </div>
            </Panel>
          )}

          {/* Sub-Tab 4: Rerouting / Recommendation (Explicit Unavailable State) */}
          {activeTab === 'rerouting' && (
            <Panel title="RECOMMENDED RESPONSE" actions={<ShieldAlert className="w-4 h-4 text-text-muted" />}>
              <div className="p-4 rounded bg-bg-elevated border border-border-subtle text-center space-y-2">
                <ShieldAlert className="w-7 h-7 text-text-muted mx-auto opacity-50" />
                <p className="text-sm font-semibold text-text-primary">Recommendation unavailable</p>
                <p className="text-xs text-text-secondary leading-relaxed max-w-xs mx-auto">
                  Automated rerouting and authority dispatch will appear here when recommendation engine is connected.
                </p>
              </div>
            </Panel>
          )}

          {/* Historical Trend Chart */}
          <Panel title="Congestion Trend" subtitle="Delay percentage over time">
            {chartData.length === 0 ? (
              <div className="h-28 flex flex-col items-center justify-center text-center p-3 text-text-muted text-xs">
                <TrendingUp className="w-5 h-5 mb-1 opacity-40" />
                <span>No historical congestion records for selected time window</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="delayGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={9} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={9} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px' }}
                    labelStyle={{ color: 'var(--text-secondary)' }}
                  />
                  <Area type="monotone" dataKey="delayPct" stroke="var(--accent)" strokeWidth={2} fill="url(#delayGrad)" name="Delay %" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
