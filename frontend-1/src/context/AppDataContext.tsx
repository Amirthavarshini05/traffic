import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { api } from '@/lib/api';
import { useTimeRange } from '@/context/TimeRangeContext';
import type {
  Camera,
  CameraRoute,
  Alert,
  AnalyticsSummary,
  CameraHealthResponse,
  AnomalySummary,
  RouteAnalyticsResponse,
  ODMatrixResponse,
  ZoneTrafficResponse,
  PropagationResponse,
  CongestionHistoryResponse,
  SystemHealthStatus,
  DetailedSystemHealth,
  WatchlistEntry,
} from '@/types';

interface AppDataContextValue {
  cameras: Camera[];
  cameraRoutes: CameraRoute[];
  cameraHealth: CameraHealthResponse | null;
  alerts: Alert[];
  summary: AnalyticsSummary;
  anomalies: AnomalySummary;
  routeAnalytics: RouteAnalyticsResponse | null;
  odMatrix: ODMatrixResponse | null;
  zoneTraffic: ZoneTrafficResponse | null;
  propagation: PropagationResponse | null;
  congestionHistory: CongestionHistoryResponse | null;
  systemHealth: SystemHealthStatus;
  detailedHealth: DetailedSystemHealth | null;
  blacklisted: BlacklistedVehicle[];
  watchlist: WatchlistEntry[];
  startTime: string;
  endTime: string;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
}

const defaultSummary: AnalyticsSummary = {};
const defaultSystemHealth: SystemHealthStatus = {
  api: 'UNKNOWN',
  database: 'UNKNOWN',
  redis: 'UNKNOWN',
  realtime: 'UNKNOWN',
  camera_network: 'UNKNOWN',
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { apiParam, startTime, endTime } = useTimeRange();
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [cameraRoutes, setCameraRoutes] = useState<CameraRoute[]>([]);
  const [cameraHealth, setCameraHealth] = useState<CameraHealthResponse | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary>(defaultSummary);
  const [anomalies, setAnomalies] = useState<AnomalySummary>({});
  const [routeAnalytics, setRouteAnalytics] = useState<RouteAnalyticsResponse | null>(null);
  const [odMatrix, setOdMatrix] = useState<ODMatrixResponse | null>(null);
  const [zoneTraffic, setZoneTraffic] = useState<ZoneTrafficResponse | null>(null);
  const [propagation, setPropagation] = useState<PropagationResponse | null>(null);
  const [congestionHistory, setCongestionHistory] = useState<CongestionHistoryResponse | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealthStatus>(defaultSystemHealth);
  const [detailedHealth, setDetailedHealth] = useState<DetailedSystemHealth | null>(null);
  const [blacklisted, setBlacklisted] = useState<BlacklistedVehicle[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = apiParam || undefined;

    try {
      const [
        cams,
        health,
        routes,
        alrts,
        smmry,
        anoms,
        routeAna,
        od,
        zones,
        prop,
        cong,
        detHealth,
        wl,
      ] = await Promise.all([
        api.getCameras(),
        api.getCameraHealth(),
        api.getCameraRoutes(),
        api.getAlerts(),
        api.getAnalyticsSummary(params),
        api.getAnomalySummary(),
        api.getRouteAnalytics(params),
        api.getODMatrix(params),
        api.getZoneTraffic(params),
        api.getCongestionPropagation(params),
        api.getCongestionHistory(params),
        api.getDetailedSystemHealth(),
        api.getWatchlist(),
      ]);

      setCameras(cams);
      setCameraHealth(health);
      setCameraRoutes(routes);
      setAlerts(alrts);
      setAnomalies(anoms);
      setRouteAnalytics(routeAna);
      setOdMatrix(od);
      setZoneTraffic(zones);
      setPropagation(prop);
      setCongestionHistory(cong);
      setDetailedHealth(detHealth);
      setWatchlist(wl);

      // Compute total vehicles observed across routes
      const totalVehicles = (routeAna.routes || []).reduce((acc, r) => acc + (r.vehicle_count || 0), 0);
      const congestedCount = (routeAna.routes || []).filter(
        (r) => r.congestion_level === 'HIGH' || r.congestion_level === 'SEVERE'
      ).length;

      // Compute weighted average speed
      let avgSpeed: number | undefined;
      const routesWithSpeed = (routeAna.routes || []).filter((r) => r.avg_speed != null);
      if (routesWithSpeed.length > 0) {
        avgSpeed = routesWithSpeed.reduce((acc, r) => acc + r.avg_speed!, 0) / routesWithSpeed.length;
      }

      setSummary({
        total_vehicles: totalVehicles > 0 ? totalVehicles : smmry.total_vehicles,
        active_cameras: health.healthy ?? smmry.active_cameras,
        offline_cameras: health.offline ?? smmry.offline_cameras,
        active_alerts: smmry.active_alerts ?? alrts.filter((a) => a.status === 'ACTIVE').length,
        congested_routes: congestedCount,
        avg_speed: avgSpeed,
        active_anomalies: anoms.route_anomalies,
      });

      const offlineCount = health.offline ?? 0;
      if (detHealth) {
        const dbStatus = detHealth.services.find((s) => s.name.toLowerCase().includes('database'))?.status;
        const redisStatus = detHealth.services.find((s) => s.name.toLowerCase().includes('redis'))?.status;
        setSystemHealth({
          api: detHealth.overall_status === 'offline' ? 'OFFLINE' : detHealth.overall_status === 'degraded' ? 'DEGRADED' : 'OPERATIONAL',
          database: dbStatus === 'offline' ? 'OFFLINE' : dbStatus === 'degraded' ? 'DEGRADED' : 'OPERATIONAL',
          redis: redisStatus === 'offline' ? 'OFFLINE' : redisStatus === 'degraded' ? 'DEGRADED' : 'OPERATIONAL',
          realtime: 'OPERATIONAL',
          camera_network: offlineCount > 0 ? 'DEGRADED' : 'OPERATIONAL',
        });
      } else {
        setSystemHealth({
          api: 'OPERATIONAL',
          database: 'OPERATIONAL',
          redis: 'OPERATIONAL',
          realtime: 'OPERATIONAL',
          camera_network: offlineCount > 0 ? 'DEGRADED' : 'OPERATIONAL',
        });
      }

      // Filter blacklisted vehicles if present in alerts
      const bl: BlacklistedVehicle[] = alrts
        .filter((a) => a.category === 'Blacklisted Vehicle')
        .map((a) => ({
          plate: a.vehicle_id,
          vehicle_id: a.vehicle_id,
          first_detection: a.timestamp,
          last_detection: a.timestamp,
          camera_id: a.camera_id,
          zone: a.zone,
          timestamp: a.timestamp,
          status: a.status,
          priority: a.severity === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
        }));
      setBlacklisted(bl);

      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('[AppDataContext] Failed to load data:', err);
      setError(err?.message || 'Failed to connect to traffic backend');
      setSystemHealth((prev) => ({
        ...prev,
        api: 'DEGRADED',
      }));
    } finally {
      setLoading(false);
    }
  }, [apiParam]);

  // Listen for realtime WebSocket updates to update state reactively
  useEffect(() => {
    const handleRealtimeUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<any>;
      const data = customEvent.detail;
      if (!data) return;

      if (data.event_type === 'alert_events' || data.alert_id) {
        refresh();
      }
    };

    window.addEventListener('traffic-realtime-update', handleRealtimeUpdate);
    return () => window.removeEventListener('traffic-realtime-update', handleRealtimeUpdate);
  }, [refresh]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <AppDataContext.Provider
      value={{
        cameras,
        cameraRoutes,
        cameraHealth,
        alerts,
        summary,
        anomalies,
        routeAnalytics,
        odMatrix,
        zoneTraffic,
        propagation,
        congestionHistory,
        systemHealth,
        detailedHealth,
        blacklisted,
        watchlist,
        startTime,
        endTime,
        loading,
        error,
        lastUpdated,
        refresh,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
