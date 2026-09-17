import { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import { CityTrafficMap, type CityTrafficMapHandle, type MapLayerConfig } from '@/components/map/CityTrafficMap';
import { MapLegend } from '@/components/map/MapLegend';
import { Panel } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { TimeRangeSelector } from '@/components/ui/TimeRangeSelector';
import { MapActionButton } from '@/components/ui/MapActionButton';
import { useAppData } from '@/context/AppDataContext';
import { useSelection } from '@/context/SelectionContext';
import { useTimeRange } from '@/context/TimeRangeContext';
import { api } from '@/lib/api';
import { formatNumber, formatTime, cn } from '@/lib/utils';
import {
  ArrowRight,
  AlertTriangle,
  HelpCircle,
  MapPin,
  Layers,
  Activity,
  BarChart3,
  Download,
  Calendar,
  Gauge,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import type { PageId } from '@/components/layout/Sidebar';
import type { ODRecord, RouteAnalytics, RouteComparison } from '@/types';

const MAP_LAYERS: MapLayerConfig = {
  cameras: true,
  routes: true,
  odFlow: true,
};

export function RouteOD({ onNavigate }: { onNavigate?: (p: PageId) => void }) {
  const { odMatrix, routeAnalytics, cameras, alerts } = useAppData();
  const { selection, setSelection, clearSelection } = useSelection();
  const { startTime, endTime } = useTimeRange();
  const mapRef = useRef<CityTrafficMapHandle>(null);

  const [originCam, setOriginCam] = useState<string>('CAM02');
  const [destCam, setDestCam] = useState<string>('CAM01');
  const [displayMode, setDisplayMode] = useState<'flow' | 'trajectory'>('flow');

  // Baseline Comparison State
  const [baselineType, setBaselineType] = useState<'same_time_yesterday' | 'same_time_last_week' | 'previous_period'>('same_time_yesterday');
  const [comparison, setComparison] = useState<RouteComparison | null>(null);
  const [loadingComparison, setLoadingComparison] = useState(false);

  const odRecords = useMemo(() => odMatrix?.records || [], [odMatrix]);
  const total = useMemo(
    () => odMatrix?.total ?? odRecords.reduce((s, r) => s + r.vehicle_count, 0),
    [odMatrix, odRecords]
  );
  const routes = useMemo(() => routeAnalytics?.routes || [], [routeAnalytics]);

  const handleRouteClick = useCallback(
    (routeId: string) => {
      setSelection({ type: 'route', id: routeId });
      if (routeId.includes('_')) {
        const [from, to] = routeId.split('_');
        if (from && to) {
          setOriginCam(from);
          setDestCam(to);
        }
      }
    },
    [setSelection]
  );
  const handleMapClick = useCallback(() => clearSelection(), [clearSelection]);

  // Keep selection synchronized with selected Origin and Destination pair
  useEffect(() => {
    if (!selection || selection.type !== 'route') {
      setSelection({ type: 'route', id: `${originCam}_${destCam}` });
    }
  }, [selection, originCam, destCam, setSelection]);

  // Fetch Historical Baseline Comparison
  useEffect(() => {
    let isMounted = true;
    setLoadingComparison(true);
    api.getRouteComparison(`${originCam}_${destCam}`, baselineType, startTime, endTime)
      .then((res) => {
        if (isMounted) setComparison(res);
      })
      .catch((err) => {
        console.error('Failed to fetch route comparison:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingComparison(false);
      });
    return () => {
      isMounted = false;
    };
  }, [originCam, destCam, baselineType, startTime, endTime]);

  // Selected route data
  const selectedRoute = useMemo(() => {
    if (selection?.type === 'route') {
      const match = routes.find(
        (r) =>
          r.route_id === selection.id ||
          `${r.from_camera_id}_${r.to_camera_id}` === selection.id ||
          (selection.id.includes('_') &&
            r.from_camera_id === selection.id.split('_')[0] &&
            r.to_camera_id === selection.id.split('_')[1])
      );
      if (match) return match;
    }
    const directMatch = routes.find(
      (r) => r.from_camera_id === originCam && r.to_camera_id === destCam
    );
    if (directMatch) return directMatch;

    return {
      route_id: `${originCam}_${destCam}`,
      from_camera_id: originCam,
      to_camera_id: destCam,
      route_name: `${originCam} → ${destCam}`,
      vehicle_count: undefined,
      trajectory_count: undefined,
      avg_travel_time: undefined,
      baseline_travel_time: undefined,
      delay: undefined,
      congestion_level: undefined,
    };
  }, [selection, routes, originCam, destCam]);

  const matchingOd = useMemo(() => {
    return odRecords.find(
      (r) => r.from_camera_id === originCam && r.to_camera_id === destCam
    );
  }, [odRecords, originCam, destCam]);

  const routeAnomalies = useMemo(() => {
    return alerts.filter(
      (a) =>
        a.category === 'Route Anomaly' ||
        a.alert_type === 'ROUTE_DEVIATION' ||
        a.title?.toUpperCase().includes('ROUTE')
    );
  }, [alerts]);

  const odColumns: Column<ODRecord>[] = [
    {
      key: 'rank',
      header: 'Rank',
      align: 'center' as const,
      render: (r: ODRecord) => <Badge color="blue" size="sm">#{r.rank || 1}</Badge>,
    },
    {
      key: 'from',
      header: 'Origin',
      render: (r) => <span className="font-mono font-semibold text-xs text-text-primary">{r.from_camera_name || r.from_camera_id}</span>,
    },
    {
      key: 'to',
      header: 'Destination',
      render: (r) => (
        <div className="flex items-center gap-1">
          <ArrowRight className="w-3 h-3 text-accent-light" />
          <span className="font-mono font-semibold text-xs text-text-primary">{r.to_camera_name || r.to_camera_id}</span>
        </div>
      ),
    },
    {
      key: 'vehicle_count',
      header: 'Vehicles',
      align: 'right' as const,
      render: (r) => <span className="font-bold text-text-primary font-mono">{formatNumber(r.vehicle_count)}</span>,
    },
    {
      key: 'share',
      header: 'Share',
      align: 'right' as const,
      render: (r) => {
        const pct = r.share_pct ?? (total > 0 ? (r.vehicle_count / total) * 100 : 0);
        return (
          <div className="flex items-center gap-2 justify-end">
            <div className="w-12 h-1.5 rounded-full bg-bg-elevated overflow-hidden">
              <div className="h-full bg-accent rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <span className="text-xs font-medium text-text-secondary font-mono">{pct.toFixed(1)}%</span>
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col h-full gap-2 p-2 overflow-hidden">
      {/* 1. Top Controls: Origin, Destination, Mode, Export, TimeRange */}
      <div className="flex items-center justify-between gap-2 p-1.5 rounded bg-surface border border-border shrink-0 flex-wrap">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-text-muted font-medium">Origin:</span>
          <select
            value={originCam}
            onChange={(e) => {
              setOriginCam(e.target.value);
              setSelection({ type: 'route', id: `${e.target.value}_${destCam}` });
            }}
            className="px-2 py-1 rounded bg-bg-elevated border border-border font-mono text-text-primary text-xs focus:outline-none focus:border-accent"
          >
            {cameras.map((c) => (
              <option key={c.camera_id} value={c.camera_id}>{c.camera_id} - {c.name || c.zone}</option>
            ))}
          </select>

          <ArrowRight className="w-3.5 h-3.5 text-text-muted" />

          <span className="text-text-muted font-medium">Destination:</span>
          <select
            value={destCam}
            onChange={(e) => {
              setDestCam(e.target.value);
              setSelection({ type: 'route', id: `${originCam}_${e.target.value}` });
            }}
            className="px-2 py-1 rounded bg-bg-elevated border border-border font-mono text-text-primary text-xs focus:outline-none focus:border-accent"
          >
            {cameras.map((c) => (
              <option key={c.camera_id} value={c.camera_id}>{c.camera_id} - {c.name || c.zone}</option>
            ))}
          </select>

          {/* Mode Switch: [ Flow ] [ Observed Trajectories ] */}
          <div className="flex items-center gap-0.5 p-0.5 rounded bg-bg-elevated border border-border ml-2">
            <button
              onClick={() => setDisplayMode('flow')}
              className={cn(
                'px-2 py-0.5 rounded text-[11px] font-medium transition-colors',
                displayMode === 'flow' ? 'bg-accent text-white font-semibold' : 'text-text-muted hover:text-text-primary'
              )}
            >
              Flow
            </button>
            <button
              onClick={() => setDisplayMode('trajectory')}
              className={cn(
                'px-2 py-0.5 rounded text-[11px] font-medium transition-colors',
                displayMode === 'trajectory' ? 'bg-accent text-white font-semibold' : 'text-text-muted hover:text-text-primary'
              )}
            >
              Observed Trajectories
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Export OD Matrix Button */}
          <a
            href={api.getExportUrl('od-matrix', 'csv', startTime, endTime)}
            download="od_matrix_export.csv"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-bg-elevated border border-border text-xs text-text-primary hover:border-accent transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-accent-light" />
            <span>Export OD Matrix</span>
          </a>

          <TimeRangeSelector variant="full" />
        </div>
      </div>

      {/* 2. Main OD Layout: Left Map & Table vs Right Historical Comparison */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_390px] gap-2 min-h-0">
        {/* Left: Interactive Map + Flow Mode Aggregated Summary Chip */}
        <div className="panel relative overflow-hidden min-h-0 flex flex-col">
          <div className="flex-1 relative">
            <CityTrafficMap
              ref={mapRef}
              layers={MAP_LAYERS}
              onRouteClick={handleRouteClick}
              onMapClick={handleMapClick}
              flowOriginCam={originCam}
              flowDestCam={destCam}
            />
            <MapLegend layers={MAP_LAYERS} />
          </div>

          {/* Flow Mode Aggregated Summary Chip */}
          <div className="h-8 px-3 bg-surface/90 border-t border-border flex items-center justify-between text-xs font-mono text-text-secondary z-10 shrink-0">
            <span className="font-sans text-[11px] text-text-muted">
              Active Flow ({originCam} ════► {destCam}):
            </span>
            {matchingOd ? (
              <div className="flex items-center gap-3">
                <span><strong>{formatNumber(matchingOd.vehicle_count)}</strong> vehicles observed</span>
                <span className="text-accent-light font-bold">
                  {(matchingOd.share_pct ?? (total > 0 ? (matchingOd.vehicle_count / total) * 100 : 0)).toFixed(1)}% of total OD volume
                </span>
                <span className="text-text-muted">Rank #{matchingOd.rank || 1}</span>
              </div>
            ) : (
              <span className="text-text-muted italic">No direct flow recorded for this pair in horizon</span>
            )}
          </div>
        </div>

        {/* Right Side: Historical Baseline Comparison & Route Anomaly */}
        <div className="flex flex-col gap-2 min-h-0 overflow-y-auto scrollbar-thin">
          {/* HISTORICAL BASELINE COMPARISON PANEL */}
          <Panel
            title={`${originCam} → ${destCam}`}
            subtitle="Historical Baseline Comparison Engine"
            actions={
              comparison ? (
                <Badge
                  color={
                    comparison.congestion_level === 'SEVERE'
                      ? 'red'
                      : comparison.congestion_level === 'HIGH'
                      ? 'amber'
                      : comparison.congestion_level === 'MODERATE'
                      ? 'blue'
                      : 'green'
                  }
                  size="sm"
                >
                  {comparison.congestion_level}
                </Badge>
              ) : undefined
            }
          >
            {/* Baseline Period Switcher */}
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-1 rounded bg-bg-elevated border border-border-subtle">
                <span className="text-[10px] text-text-muted uppercase font-semibold pl-1">Baseline:</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setBaselineType('same_time_yesterday')}
                    className={cn(
                      'px-2 py-0.5 rounded text-[10px] transition-colors',
                      baselineType === 'same_time_yesterday'
                        ? 'bg-accent text-white font-semibold'
                        : 'text-text-muted hover:text-text-primary'
                    )}
                  >
                    Yesterday
                  </button>
                  <button
                    onClick={() => setBaselineType('same_time_last_week')}
                    className={cn(
                      'px-2 py-0.5 rounded text-[10px] transition-colors',
                      baselineType === 'same_time_last_week'
                        ? 'bg-accent text-white font-semibold'
                        : 'text-text-muted hover:text-text-primary'
                    )}
                  >
                    Last Week
                  </button>
                  <button
                    onClick={() => setBaselineType('previous_period')}
                    className={cn(
                      'px-2 py-0.5 rounded text-[10px] transition-colors',
                      baselineType === 'previous_period'
                        ? 'bg-accent text-white font-semibold'
                        : 'text-text-muted hover:text-text-primary'
                    )}
                  >
                    Prev Period
                  </button>
                </div>
              </div>

              {/* Comparison Cards Grid */}
              <div className="grid grid-cols-2 gap-2">
                {/* 1. Volume Comparison */}
                <div className="p-2.5 rounded bg-bg-elevated border border-border-subtle flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-semibold text-text-muted block">Volume</span>
                  <div className="mt-1">
                    <span className="font-mono font-bold text-sm text-text-primary block">
                      {comparison?.volume_comparison.current_value != null
                        ? formatNumber(comparison.volume_comparison.current_value)
                        : 'Unavailable'}
                    </span>
                    <span className="text-[10px] text-text-muted block">
                      Base:{' '}
                      {comparison?.volume_comparison.baseline_value != null
                        ? formatNumber(comparison.volume_comparison.baseline_value)
                        : 'Unavailable'}
                    </span>
                  </div>
                  {comparison?.volume_comparison.percentage_change != null && (
                    <div className="mt-1 flex items-center gap-1 text-[11px] font-mono">
                      {comparison.volume_comparison.percentage_change >= 0 ? (
                        <span className="text-warning flex items-center">
                          <TrendingUp className="w-3 h-3 mr-0.5" />
                          +{comparison.volume_comparison.percentage_change}%
                        </span>
                      ) : (
                        <span className="text-success flex items-center">
                          <TrendingDown className="w-3 h-3 mr-0.5" />
                          {comparison.volume_comparison.percentage_change}%
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Travel Time Comparison */}
                <div className="p-2.5 rounded bg-bg-elevated border border-border-subtle flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-semibold text-text-muted block">Travel Time</span>
                  <div className="mt-1">
                    <span className="font-mono font-bold text-sm text-text-primary block">
                      {comparison?.travel_time_comparison.current_value != null
                        ? formatTime(comparison.travel_time_comparison.current_value)
                        : 'Unavailable'}
                    </span>
                    <span className="text-[10px] text-text-muted block">
                      Base:{' '}
                      {comparison?.travel_time_comparison.baseline_value != null
                        ? formatTime(comparison.travel_time_comparison.baseline_value)
                        : 'Unavailable'}
                    </span>
                  </div>
                  {comparison?.travel_time_comparison.percentage_change != null && (
                    <div className="mt-1 flex items-center gap-1 text-[11px] font-mono">
                      {comparison.travel_time_comparison.percentage_change > 15 ? (
                        <span className="text-critical font-semibold flex items-center">
                          +{comparison.travel_time_comparison.percentage_change}% delay
                        </span>
                      ) : comparison.travel_time_comparison.percentage_change >= 0 ? (
                        <span className="text-warning flex items-center">
                          +{comparison.travel_time_comparison.percentage_change}%
                        </span>
                      ) : (
                        <span className="text-success flex items-center">
                          {comparison.travel_time_comparison.percentage_change}%
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Speed Metric */}
                <div className="p-2.5 rounded bg-bg-elevated border border-border-subtle col-span-2 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-text-muted block">Calculated Speed</span>
                    {comparison?.speed_status === 'available' && comparison.speed_kmh != null ? (
                      <span className="font-mono font-bold text-sm text-success">
                        {comparison.speed_kmh} km/h
                      </span>
                    ) : (
                      <span className="font-mono text-xs text-text-muted">
                        Unavailable (Road geometry uncalibrated)
                      </span>
                    )}
                  </div>
                  <Gauge className="w-4 h-4 text-text-muted" />
                </div>
              </div>

              {/* What Does This Mean Callout */}
              <div className="p-2.5 rounded bg-accent/10 border border-accent/25 space-y-1">
                <div className="flex items-center gap-1 text-accent-light text-xs font-semibold">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>BASELINE INTERPRETATION</span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {comparison?.travel_time_comparison.percentage_change != null &&
                  comparison.travel_time_comparison.percentage_change > 20
                    ? `Corridor travel time is ${comparison.travel_time_comparison.percentage_change}% higher than ${
                        baselineType === 'same_time_yesterday'
                          ? 'yesterday at this time'
                          : baselineType === 'same_time_last_week'
                          ? 'last week'
                          : 'the previous interval'
                      }, confirming anomalous congestion.`
                    : comparison?.travel_time_comparison.current_value != null
                    ? `Travel time is within standard variance relative to historical ${
                        baselineType === 'same_time_yesterday' ? 'yesterday' : 'baseline'
                      } levels.`
                    : 'Corridor observations in this window are sparse or pending trajectory completion.'}
                </p>
              </div>

              {/* Quick action to navigate to Congestion Analytics */}
              {onNavigate && (
                <div className="pt-1">
                  <button
                    onClick={() => onNavigate('analytics')}
                    className="w-full py-1.5 px-3 rounded bg-accent/15 hover:bg-accent/25 text-accent-light text-xs font-semibold border border-accent/30 flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>View Congestion Propagation Engine →</span>
                  </button>
                </div>
              )}
            </div>
          </Panel>

          {/* Route Anomaly Panel */}
          <Panel title="ROUTE ANOMALIES" actions={<AlertTriangle className="w-4 h-4 text-critical" />}>
            {routeAnomalies.length > 0 ? (
              <div className="space-y-2">
                {routeAnomalies.map((a, idx) => (
                  <div key={idx} className="p-3 rounded bg-bg-elevated border border-border-subtle space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-text-primary">
                        {a.vehicle_id ? `Vehicle ${a.vehicle_id}` : 'Corridor Anomaly'}
                      </span>
                      <Badge color="red" size="sm">{a.severity || 'UNEXPECTED ROUTE'}</Badge>
                    </div>
                    <p className="text-text-secondary leading-relaxed">{a.message}</p>
                    <div className="flex items-center gap-2 pt-1">
                      <MapActionButton
                        onClick={() => {
                          setSelection({
                            type: 'route',
                            id: a.camera_id || `${originCam}_${destCam}`,
                          });
                        }}
                        icon={<MapPin className="w-3 h-3" />}
                        variant="primary"
                      >
                        View on Map
                      </MapActionButton>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded bg-bg-elevated border border-border-subtle text-xs text-text-muted">
                No active route deviation anomalies detected on this corridor.
              </div>
            )}
          </Panel>

          {/* OD Flow Ranking Table */}
          <Panel title="ORIGIN-DESTINATION PAIR MATRIX" subtitle="Ranked movement volumes">
            <DataTable
              columns={odColumns}
              data={odRecords}
              maxHeight="260px"
              onRowClick={(r) => {
                setOriginCam(r.from_camera_id);
                setDestCam(r.to_camera_id);
                setSelection({ type: 'route', id: `${r.from_camera_id}_${r.to_camera_id}` });
              }}
            />
          </Panel>
        </div>
      </div>
    </div>
  );
}
