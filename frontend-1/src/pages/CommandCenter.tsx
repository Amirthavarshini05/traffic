import { useRef, useCallback, useMemo } from 'react';
import { CityTrafficMap, type CityTrafficMapHandle, type MapLayerConfig } from '@/components/map/CityTrafficMap';
import { MapLegend } from '@/components/map/MapLegend';
import { KpiCard } from '@/components/ui/KpiCard';
import { ObjectToast } from '@/components/ui/ObjectToast';
import { MapActionButton } from '@/components/ui/MapActionButton';
import { useAppData } from '@/context/AppDataContext';
import { useSelection } from '@/context/SelectionContext';
import { formatNumber, cn } from '@/lib/utils';
import {
  Car,
  Camera,
  CameraOff,
  Siren,
  AlertTriangle,
  Gauge,
  Radar,
  MapPin,
  BarChart3,
  Route as RouteIcon,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import type { PageId } from '@/components/layout/Sidebar';

const MAP_LAYERS: MapLayerConfig = {
  cameras: true,
  cameraHealth: true,
  routes: true,
  congestion: true,
  trafficDensity: true,
  incidents: true,
};

export function CommandCenter({ onNavigate }: { onNavigate: (p: PageId) => void }) {
  const mapRef = useRef<CityTrafficMapHandle>(null);
  const { summary, cameraHealth, cameras, alerts, routeAnalytics, loading } = useAppData();
  const { selection, setSelection, clearSelection } = useSelection();

  const offlineCameras = cameraHealth?.offline ?? summary.offline_cameras ?? 0;
  const activeCameras = cameraHealth?.healthy ?? summary.active_cameras ?? 0;
  const totalCameras = cameraHealth?.total ?? cameras.length;
  const activeAlerts = summary.active_alerts ?? alerts.filter((a) => a.status === 'ACTIVE').length;
  const routes = routeAnalytics?.routes ?? [];

  const handleCameraClick = useCallback(
    (cameraId: string) => {
      setSelection({ type: 'camera', id: cameraId });
    },
    [setSelection]
  );

  const handleRouteClick = useCallback(
    (routeId: string) => {
      setSelection({ type: 'route', id: routeId });
    },
    [setSelection]
  );

  const handleMapClick = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const selectedCamera = useMemo(() => {
    if (selection?.type !== 'camera') return null;
    const cam = cameraHealth?.cameras?.find((c) => c.camera_id === selection.id);
    const baseCam = cameras.find((c) => c.camera_id === selection.id);
    if (!cam && !baseCam) return null;
    return {
      camera_id: selection.id,
      name: cam?.name || baseCam?.name || 'Camera Node',
      status: cam?.status || baseCam?.status || 'HEALTHY',
    };
  }, [selection, cameraHealth, cameras]);

  const selectedRoute = useMemo(() => {
    if (selection?.type !== 'route') return null;
    return routes.find(
      (r) => r.route_id === selection.id || `${r.from_camera_id}_${r.to_camera_id}` === selection.id
    ) || null;
  }, [selection, routes]);

  const selectedAlert = useMemo(() => {
    if (selection?.type !== 'alert') return null;
    return alerts.find((a) => a.alert_id === selection.id) || null;
  }, [selection, alerts]);

  // Congestion rank for bottom bar: real routes sorted by vehicle_count / delay
  const topCongestedRoutes = useMemo(() => {
    return [...routes]
      .sort((a, b) => (b.vehicle_count ?? 0) - (a.vehicle_count ?? 0))
      .slice(0, 3);
  }, [routes]);

  // Camera issues from real cameraHealth response
  const cameraIssues = useMemo(() => {
    const issues = cameraHealth?.cameras?.filter((c) => c.status === 'OFFLINE' || c.status === 'WARNING') ?? [];
    return issues.slice(0, 3);
  }, [cameraHealth]);

  // Active alerts from real alerts API
  const topAlerts = useMemo(() => {
    return alerts.filter((a) => a.status === 'ACTIVE').slice(0, 3);
  }, [alerts]);

  return (
    <div className="flex flex-col h-full gap-2 p-2 overflow-hidden">
      {/* 1. Top KPIs: Real data with operational context */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-1.5 shrink-0">
        <KpiCard
          label="Average Speed"
          value={loading ? undefined : summary.avg_speed != null ? summary.avg_speed.toFixed(1) : 'Unavailable'}
          unit={summary.avg_speed != null ? 'km/h' : undefined}
          explanation={summary.avg_speed != null ? 'Average corridor velocity' : 'Speed telemetry unavailable'}
          icon={<Gauge className="w-3.5 h-3.5" />}
          loading={loading}
        />
        <KpiCard
          label="Vehicles Observed"
          value={loading ? undefined : summary.total_vehicles != null ? formatNumber(summary.total_vehicles) : '0'}
          explanation="Vehicles monitored across city network"
          icon={<Car className="w-3.5 h-3.5" />}
          loading={loading}
        />
        <KpiCard
          label="Active Cameras"
          value={loading ? undefined : formatNumber(activeCameras)}
          trend={totalCameras > 0 ? `${Math.round((activeCameras / totalCameras) * 100)}% online` : undefined}
          explanation="Operational surveillance nodes"
          icon={<Camera className="w-3.5 h-3.5" />}
          status="success"
          loading={loading}
        />
        <KpiCard
          label="Offline Cameras"
          value={loading ? undefined : formatNumber(offlineCameras)}
          trend={offlineCameras > 0 ? 'Requires attention' : 'Nominal'}
          trendBad={offlineCameras > 0}
          explanation={offlineCameras > 0 ? `${offlineCameras} nodes disconnected` : 'All camera feeds healthy'}
          icon={<CameraOff className="w-3.5 h-3.5" />}
          status={offlineCameras > 0 ? 'critical' : 'success'}
          loading={loading}
        />
        <KpiCard
          label="Active Alerts"
          value={loading ? undefined : formatNumber(activeAlerts)}
          trend={activeAlerts > 0 ? 'Action required' : 'Nominal'}
          trendBad={activeAlerts > 0}
          explanation={activeAlerts > 0 ? `${activeAlerts} active incidents` : 'Zero critical alerts'}
          icon={<Siren className="w-3.5 h-3.5" />}
          status={activeAlerts > 0 ? 'critical' : 'success'}
          loading={loading}
        />
        <KpiCard
          label="Congested Routes"
          value={loading ? undefined : formatNumber(summary.congested_routes ?? 0)}
          trend={summary.congested_routes ? `${summary.congested_routes} corridors` : 'Smooth'}
          trendBad={!!summary.congested_routes}
          explanation={summary.congested_routes ? 'Routes experiencing delay' : 'No delay above baseline'}
          icon={<AlertTriangle className="w-3.5 h-3.5" />}
          status={summary.congested_routes ? 'warning' : 'neutral'}
          loading={loading}
        />
        <KpiCard
          label="Active Anomalies"
          value={loading ? undefined : formatNumber(summary.active_anomalies ?? 0)}
          trend={summary.active_anomalies ? `${summary.active_anomalies} deviations` : 'Normal'}
          trendBad={!!summary.active_anomalies}
          explanation="Route deviations & collective movement"
          icon={<Radar className="w-3.5 h-3.5" />}
          status={summary.active_anomalies ? 'warning' : 'neutral'}
          loading={loading}
        />
      </div>

      {/* 2. Primary City Map: Dominates the center */}
      <div className="flex-1 panel relative overflow-hidden min-h-0">
        <CityTrafficMap
          ref={mapRef}
          layers={MAP_LAYERS}
          routeAnalytics={routes}
          onCameraClick={handleCameraClick}
          onRouteClick={handleRouteClick}
          onMapClick={handleMapClick}
        />
        <MapLegend layers={MAP_LAYERS} />

        {/* Selected Camera Toast */}
        {selection?.type === 'camera' && selectedCamera && (
          <ObjectToast
            visible={true}
            title={selectedCamera.camera_id}
            subtitle={selectedCamera.name}
            status={{
              label: selectedCamera.status,
              color: selectedCamera.status === 'HEALTHY' ? 'green' : selectedCamera.status === 'OFFLINE' ? 'red' : 'amber',
            }}
            position="bottom-left"
            actions={
              <div className="flex items-center gap-1.5 flex-wrap">
                <MapActionButton
                  onClick={() => onNavigate('analytics')}
                  icon={<BarChart3 className="w-3 h-3" />}
                  variant="primary"
                >
                  Congestion Analytics →
                </MapActionButton>
                <MapActionButton
                  onClick={() => onNavigate('routes')}
                  icon={<RouteIcon className="w-3 h-3" />}
                  variant="secondary"
                >
                  OD Matrix
                </MapActionButton>
              </div>
            }
          />
        )}

        {/* Selected Route Toast */}
        {selection?.type === 'route' && selectedRoute && (
          <ObjectToast
            visible={true}
            title={`${selectedRoute.from_camera_id} → ${selectedRoute.to_camera_id}`}
            subtitle={`${selectedRoute.vehicle_count ?? 0} vehicles · Travel time ${selectedRoute.avg_travel_time != null ? `${selectedRoute.avg_travel_time.toFixed(0)}s` : 'N/A'}`}
            status={{
              label: selectedRoute.congestion_level || 'Normal',
              color: selectedRoute.congestion_level === 'HIGH' ? 'red' : selectedRoute.congestion_level === 'MODERATE' ? 'amber' : 'green',
            }}
            position="bottom-left"
            actions={
              <div className="flex items-center gap-1.5 flex-wrap">
                <MapActionButton
                  onClick={() => onNavigate('analytics')}
                  icon={<BarChart3 className="w-3 h-3" />}
                  variant="secondary"
                >
                  Congestion Page →
                </MapActionButton>
                <MapActionButton
                  onClick={() => onNavigate('routes')}
                  icon={<RouteIcon className="w-3 h-3" />}
                  variant="primary"
                >
                  Route & OD Page →
                </MapActionButton>
              </div>
            }
          />
        )}

        {/* Selected Alert Toast */}
        {selection?.type === 'alert' && selectedAlert && (
          <ObjectToast
            visible={true}
            title={selectedAlert.title}
            subtitle={selectedAlert.vehicle_id ? `Vehicle #${selectedAlert.vehicle_id}` : selectedAlert.camera_id ? `Camera ${selectedAlert.camera_id}` : selectedAlert.zone || ''}
            status={{
              label: selectedAlert.severity,
              color: selectedAlert.severity === 'CRITICAL' ? 'red' : 'amber',
            }}
            position="bottom-left"
            actions={
              <div className="flex items-center gap-1">
                <MapActionButton
                  onClick={() => onNavigate('alerts')}
                  icon={<Siren className="w-3 h-3" />}
                  variant="primary"
                >
                  View Alert
                </MapActionButton>
                {selectedAlert.vehicle_id && (
                  <MapActionButton
                    onClick={() => {
                      setSelection({ type: 'vehicle', id: selectedAlert.vehicle_id! });
                      onNavigate('vehicles');
                    }}
                    icon={<Car className="w-3 h-3" />}
                  >
                    View Vehicle
                  </MapActionButton>
                )}
              </div>
            }
          />
        )}

        {/* Default prompt if no selection */}
        {!selection && (
          <div className="absolute bottom-3 left-3 z-10 panel px-3 py-1.5 text-xs text-text-muted flex items-center gap-1.5 shadow-md">
            <MapPin className="w-3.5 h-3.5 text-accent-light" />
            <span>Select any camera, route, or alert marker to view operational details</span>
          </div>
        )}
      </div>

      {/* 3. Bottom Operational Supporting Area: Real highest congestion, Camera warnings, Active alerts */}
      <div className="h-28 grid grid-cols-1 md:grid-cols-3 gap-2 shrink-0">
        {/* Highest Congestion */}
        <div className="panel p-2 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between pb-1 border-b border-border-subtle">
            <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-warning" /> Highest Congestion
            </span>
            <button
              onClick={() => onNavigate('routes')}
              className="text-[10px] text-accent-light hover:underline flex items-center gap-0.5"
            >
              Routes <ArrowRight className="w-2.5 h-2.5" />
            </button>
          </div>
          <div className="space-y-1 my-auto overflow-y-auto">
            {topCongestedRoutes.length === 0 ? (
              <p className="text-xs text-text-muted py-2 text-center">No route congestion data available</p>
            ) : (
              topCongestedRoutes.map((r, i) => (
                <div
                  key={i}
                  onClick={() => {
                    setSelection({ type: 'route', id: r.route_id });
                    onNavigate('routes');
                  }}
                  className="flex items-center justify-between px-2 py-1 rounded bg-bg-elevated hover:bg-bg-hover cursor-pointer transition-colors text-xs"
                >
                  <span className="font-mono font-medium text-text-primary">
                    {r.from_camera_id} → {r.to_camera_id}
                  </span>
                  <span className={cn(
                    'text-[10px] font-bold px-1.5 py-0.2 rounded font-mono',
                    r.congestion_level === 'HIGH' || r.congestion_level === 'SEVERE'
                      ? 'bg-critical/15 text-critical'
                      : 'bg-warning/15 text-warning'
                  )}>
                    {r.vehicle_count} vehicles {r.avg_travel_time != null ? `(${Math.round(r.avg_travel_time)}s)` : ''}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Camera Issues */}
        <div className="panel p-2 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between pb-1 border-b border-border-subtle">
            <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider flex items-center gap-1">
              <CameraOff className="w-3 h-3 text-critical" /> Camera Warnings
            </span>
            <button
              onClick={() => onNavigate('health')}
              className="text-[10px] text-accent-light hover:underline flex items-center gap-0.5"
            >
              Health <ArrowRight className="w-2.5 h-2.5" />
            </button>
          </div>
          <div className="space-y-1 my-auto overflow-y-auto">
            {cameraIssues.length === 0 ? (
              <div className="flex items-center justify-center gap-1.5 text-xs text-success py-2">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>All {totalCameras} cameras healthy</span>
              </div>
            ) : (
              cameraIssues.map((cam, i) => (
                <div
                  key={i}
                  onClick={() => {
                    setSelection({ type: 'camera', id: cam.camera_id });
                    onNavigate('health');
                  }}
                  className="flex items-center justify-between px-2 py-1 rounded bg-bg-elevated hover:bg-bg-hover cursor-pointer transition-colors text-xs"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-medium text-text-primary">{cam.camera_id}</span>
                    <span className="text-[10px] text-text-muted truncate">{cam.name || 'Node'}</span>
                  </div>
                  <span className={cn(
                    'text-[10px] font-bold px-1.5 py-0.2 rounded font-mono',
                    cam.status === 'OFFLINE' ? 'bg-critical/15 text-critical' : 'bg-warning/15 text-warning'
                  )}>
                    {cam.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active Alerts */}
        <div className="panel p-2 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between pb-1 border-b border-border-subtle">
            <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider flex items-center gap-1">
              <Siren className="w-3 h-3 text-critical" /> Active Alerts
            </span>
            <button
              onClick={() => onNavigate('alerts')}
              className="text-[10px] text-accent-light hover:underline flex items-center gap-0.5"
            >
              All Alerts <ArrowRight className="w-2.5 h-2.5" />
            </button>
          </div>
          <div className="space-y-1 my-auto overflow-y-auto">
            {topAlerts.length === 0 ? (
              <p className="text-xs text-text-muted py-2 text-center">No active alerts recorded</p>
            ) : (
              topAlerts.map((alt, i) => (
                <div
                  key={i}
                  onClick={() => {
                    setSelection({ type: 'alert', id: alt.alert_id });
                    onNavigate('alerts');
                  }}
                  className="flex items-center justify-between px-2 py-1 rounded bg-bg-elevated hover:bg-bg-hover cursor-pointer transition-colors text-xs"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span className={cn(
                      'w-1.5 h-1.5 rounded-full shrink-0',
                      alt.severity === 'CRITICAL' ? 'bg-critical' : 'bg-warning'
                    )} />
                    <span className="font-medium text-text-primary truncate">{alt.title}</span>
                    {alt.vehicle_id && <span className="font-mono text-[10px] text-text-muted">#{alt.vehicle_id}</span>}
                  </div>
                  <span className="text-[10px] font-medium text-text-secondary shrink-0 ml-2 font-mono">
                    {alt.camera_id || alt.zone || 'Network'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
