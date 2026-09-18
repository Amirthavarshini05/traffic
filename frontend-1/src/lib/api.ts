import { API_BASE_URL } from './constants';
import type {
  Camera,
  CameraHealthResponse,
  CameraRoute,
  Alert,
  AnalyticsSummary,
  CongestionHistoryResponse,
  PropagationResponse,
  ZoneTrafficResponse,
  RouteAnalyticsResponse,
  ODMatrixResponse,
  AnomalySummary,
  VehicleTrajectory,
  CameraHealth,
  AlertSeverity,
  AlertStatus,
  CongestionLevel,
  DetailedSystemHealth,
  CameraDetail,
  VehicleSearchItem,
  EnhancedVehicleTrajectory,
  RouteComparison,
  WatchlistEntry,
  AuditLogEntry,
} from '@/types';

// Centralized fetch with timeout and error handling
async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...options?.headers,
      },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} from ${path}: ${errText || res.statusText}`);
    }

    return await res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

// Helpers to extract start_time and end_time ISO strings from parameters
function parseTimeParams(params?: string | { start_time?: string; end_time?: string }): { start_time: string; end_time: string } {
  if (typeof params === 'object' && params?.start_time && params?.end_time) {
    return { start_time: params.start_time, end_time: params.end_time };
  }

  const now = new Date();
  let start = new Date(now.getTime() - 24 * 60 * 60 * 1000); // default 24h

  if (typeof params === 'string') {
    if (params.includes('1h')) start = new Date(now.getTime() - 1 * 60 * 60 * 1000);
    else if (params.includes('6h')) start = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    else if (params.includes('24h') || params.includes('1d')) start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    else if (params.includes('7d')) start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (params.includes('30d')) start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    else if (params.includes('3m')) start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  }

  return {
    start_time: start.toISOString(),
    end_time: now.toISOString(),
  };
}

export const api = {
  // 1. GET /cameras
  getCameras: async (): Promise<Camera[]> => {
    try {
      const data = await fetchJson<{
        cameras: Array<{
          camera_id: string;
          camera_name: string;
          status: string;
          longitude: number;
          latitude: number;
        }>;
      }>('/cameras');

      return (data.cameras || []).map((c) => ({
        camera_id: c.camera_id,
        name: c.camera_name,
        status: (c.status === 'ACTIVE' ? 'HEALTHY' : c.status || 'HEALTHY') as CameraHealth,
        lat: c.latitude,
        lng: c.longitude,
      }));
    } catch (err) {
      console.error('Failed to fetch /cameras:', err);
      return [];
    }
  },

  // 2. GET /cameras/health
  getCameraHealth: async (): Promise<CameraHealthResponse> => {
    try {
      const data = await fetchJson<{
        cameras: Array<{
          camera_id: string;
          camera_name: string;
          configured_status: string;
          last_event_at: string | null;
          health_status: string;
          minutes_since_last_event: number | null;
        }>;
      }>('/cameras/health');

      const cameras = (data.cameras || []).map((c) => ({
        camera_id: c.camera_id,
        name: c.camera_name,
        status: (c.health_status || 'UNKNOWN') as CameraHealth,
        last_event_time: c.last_event_at || undefined,
        last_event:
          c.minutes_since_last_event != null
            ? `${c.minutes_since_last_event.toFixed(1)}m ago`
            : 'No events recorded',
      }));

      const healthy = cameras.filter((c) => c.status === 'HEALTHY').length;
      const warning = cameras.filter((c) => c.status === 'WARNING').length;
      const offline = cameras.filter((c) => c.status === 'OFFLINE').length;

      return {
        total: cameras.length,
        healthy,
        warning,
        offline,
        cameras,
      };
    } catch (err) {
      console.error('Failed to fetch /cameras/health:', err);
      return { total: 0, healthy: 0, warning: 0, offline: 0, cameras: [] };
    }
  },

  // 3. GET /camera-routes
  getCameraRoutes: async (): Promise<CameraRoute[]> => {
    try {
      const data = await fetchJson<{
        routes: Array<{
          route_id: number;
          starting_node: string;
          ending_node: string;
          total_distance_m: number;
          geometry: any;
        }>;
      }>('/camera-routes');

      return (data.routes || []).map((r) => {
        let from_lng: number | undefined;
        let from_lat: number | undefined;
        let to_lng: number | undefined;
        let to_lat: number | undefined;

        if (r.geometry && r.geometry.coordinates && Array.isArray(r.geometry.coordinates)) {
          const coords = r.geometry.coordinates;
          if (r.geometry.type === 'MultiLineString' && coords.length > 0 && Array.isArray(coords[0])) {
            const firstLine = coords[0];
            const lastLine = coords[coords.length - 1];
            if (firstLine.length > 0 && Array.isArray(firstLine[0])) {
              from_lng = firstLine[0][0];
              from_lat = firstLine[0][1];
            }
            if (lastLine.length > 0 && Array.isArray(lastLine[lastLine.length - 1])) {
              to_lng = lastLine[lastLine.length - 1][0];
              to_lat = lastLine[lastLine.length - 1][1];
            }
          } else if (r.geometry.type === 'LineString' && coords.length > 0 && Array.isArray(coords[0])) {
            from_lng = coords[0][0];
            from_lat = coords[0][1];
            to_lng = coords[coords.length - 1][0];
            to_lat = coords[coords.length - 1][1];
          }
        }

        return {
          route_id: String(r.route_id),
          from_camera_id: r.starting_node,
          to_camera_id: r.ending_node,
          from_lat,
          from_lng,
          to_lat,
          to_lng,
          route_name: `${r.starting_node} → ${r.ending_node}`,
          geometry: r.geometry,
        };
      });
    } catch (err) {
      console.error('Failed to fetch /camera-routes:', err);
      return [];
    }
  },

  // 4. GET /alerts
  getAlerts: async (): Promise<Alert[]> => {
    try {
      const data = await fetchJson<{
        alerts: Array<{
          alert_id: number;
          alert_type: string;
          severity: string;
          message: string;
          vehicle_id: number | null;
          road_id: string | null;
          camera_id: string | null;
          camera_name: string | null;
          zone_id: number | null;
          zone_name: string | null;
          authority_name: string | null;
          detected_at: string;
          resolved_at: string | null;
          status: string;
        }>;
      }>('/alerts');

      return (data.alerts || []).map((a) => {
        const typeStr = a.alert_type || 'ALERT';
        const isRoute = typeStr.includes('ROUTE');
        const isTravel = typeStr.includes('TRAVEL');
        const isCamera = typeStr.includes('CAMERA');
        const isCollective = typeStr.includes('COLLECTIVE');

        const category = isRoute
          ? 'Route Anomaly'
          : isTravel
          ? 'Abnormal Travel Time'
          : isCamera
          ? 'Camera Health'
          : isCollective
          ? 'Collective Movement'
          : 'Route Anomaly';

        return {
          alert_id: String(a.alert_id),
          title: typeStr.replace(/_/g, ' '),
          severity: (a.severity || 'HIGH') as AlertSeverity,
          category,
          message: a.message,
          vehicle_id: a.vehicle_id ? String(a.vehicle_id) : undefined,
          camera_id: a.camera_id || undefined,
          zone: a.zone_name || undefined,
          authority: a.authority_name || undefined,
          timestamp: a.detected_at,
          status: (a.status || 'ACTIVE') as AlertStatus,
        };
      });
    } catch (err) {
      console.error('Failed to fetch /alerts:', err);
      return [];
    }
  },

  // 5. GET /analytics/summary
  getAnalyticsSummary: async (_params?: string): Promise<AnalyticsSummary> => {
    try {
      const data = await fetchJson<{
        total_cameras: number;
        healthy_cameras: number;
        warning_cameras: number;
        offline_cameras: number;
        total_alerts: number;
        active_alerts: number;
        high_alerts: number;
        medium_alerts: number;
        critical_alerts: number;
      }>('/analytics/summary');

      return {
        active_cameras: data.healthy_cameras,
        offline_cameras: data.offline_cameras,
        active_alerts: data.active_alerts,
      };
    } catch (err) {
      console.error('Failed to fetch /analytics/summary:', err);
      return {};
    }
  },

  // 6. GET /analytics/congestion/history
  getCongestionHistory: async (params?: string): Promise<CongestionHistoryResponse> => {
    try {
      const { start_time, end_time } = parseTimeParams(params);
      const query = `?start_time=${encodeURIComponent(start_time)}&end_time=${encodeURIComponent(end_time)}`;
      const data = await fetchJson<{
        congestion: Array<{
          from_camera_id: string;
          to_camera_id: string;
          time_window_start: string;
          time_window_end: string;
          vehicle_count: number;
          baseline_travel_time_seconds: number;
          average_travel_time_seconds: number;
          average_delay_seconds: number;
          average_delay_percent: number;
          congestion_level: string;
        }>;
      }>(`/analytics/congestion/history${query}`);

      const records = (data.congestion || []).map((c) => ({
        from_camera_id: c.from_camera_id,
        to_camera_id: c.to_camera_id,
        route_id: `${c.from_camera_id}_${c.to_camera_id}`,
        route_name: `${c.from_camera_id} → ${c.to_camera_id}`,
        timestamp: c.time_window_start,
        vehicle_count: c.vehicle_count,
        baseline_travel_time: c.baseline_travel_time_seconds,
        avg_travel_time: c.average_travel_time_seconds,
        delay: c.average_delay_seconds,
        delay_pct: c.average_delay_percent,
        congestion_level: (c.congestion_level || 'LOW') as CongestionLevel,
      }));

      return { records };
    } catch (err) {
      console.error('Failed to fetch /analytics/congestion/history:', err);
      return { records: [] };
    }
  },

  // 7. GET /analytics/congestion/propagation
  getCongestionPropagation: async (_params?: string): Promise<PropagationResponse> => {
    try {
      const data = await fetchJson<{
        propagation: Array<{
          propagation_id: number;
          source_from_camera_id: string;
          source_to_camera_id: string;
          downstream_from_camera_id: string;
          downstream_to_camera_id: string;
          flow_probability_percent: number | null;
          source_congestion_level: string | null;
          propagation_score: number | null;
          propagation_level: string | null;
          estimated_impact_minutes: number | null;
          detected_at: string;
          status: string;
        }>;
      }>('/analytics/congestion/propagation');

      const records = (data.propagation || []).map((p) => ({
        source_route: `${p.source_from_camera_id} → ${p.source_to_camera_id}`,
        from_camera_id: p.source_from_camera_id,
        to_camera_id: p.source_to_camera_id,
        downstream_route: `${p.downstream_from_camera_id} → ${p.downstream_to_camera_id}`,
        probability: p.flow_probability_percent != null ? p.flow_probability_percent / 100 : undefined,
        propagation_score: p.propagation_score ?? undefined,
        estimated_impact: p.estimated_impact_minutes != null ? `${p.estimated_impact_minutes} min` : undefined,
        detected_time: p.detected_at,
        status: p.status,
      }));

      return { records };
    } catch (err) {
      console.error('Failed to fetch /analytics/congestion/propagation:', err);
      return { records: [] };
    }
  },

  // 8. GET /analytics/traffic/zones
  getZoneTraffic: async (_params?: string): Promise<ZoneTrafficResponse> => {
    try {
      const data = await fetchJson<{
        zones: Array<{
          zone_id: number;
          zone_name: string;
          authority_name: string | null;
          event_count: number;
          vehicle_count: number;
        }>;
      }>('/analytics/traffic/zones');

      const zones = (data.zones || []).map((z) => ({
        zone: z.zone_name,
        vehicle_count: z.vehicle_count,
        density: z.vehicle_count,
        congestion_level: (z.vehicle_count > 100 ? 'HIGH' : z.vehicle_count > 40 ? 'MODERATE' : 'LOW') as CongestionLevel,
      }));

      return { zones };
    } catch (err) {
      console.error('Failed to fetch /analytics/traffic/zones:', err);
      return { zones: [] };
    }
  },

  // 9. GET /analytics/traffic/routes
  getRouteAnalytics: async (_params?: string): Promise<RouteAnalyticsResponse> => {
    try {
      const data = await fetchJson<{
        routes: Array<{
          from_camera_id: string;
          to_camera_id: string;
          trajectory_count: number;
          vehicle_count: number;
          average_travel_time_seconds: number;
        }>;
      }>('/analytics/traffic/routes');

      const routes = (data.routes || []).map((r) => {
        const congestionLevel: CongestionLevel =
          r.vehicle_count > 60 ? 'HIGH' : r.vehicle_count > 25 ? 'MODERATE' : 'LOW';

        return {
          route_id: `${r.from_camera_id}_${r.to_camera_id}`,
          from_camera_id: r.from_camera_id,
          to_camera_id: r.to_camera_id,
          route_name: `${r.from_camera_id} → ${r.to_camera_id}`,
          trajectory_count: r.trajectory_count,
          vehicle_count: r.vehicle_count,
          avg_travel_time: r.average_travel_time_seconds,
          congestion_level: congestionLevel,
          delay: r.average_travel_time_seconds > 240 ? r.average_travel_time_seconds - 240 : 0,
        };
      });

      return { routes };
    } catch (err) {
      console.error('Failed to fetch /analytics/traffic/routes:', err);
      return { routes: [] };
    }
  },

  // 10. GET /analytics/od-matrix & /analytics/od-matrix/history
  getODMatrix: async (params?: string): Promise<ODMatrixResponse> => {
    try {
      let path = '/analytics/od-matrix';
      if (params && params.includes('range=')) {
        const { start_time, end_time } = parseTimeParams(params);
        path = `/analytics/od-matrix/history?start_time=${encodeURIComponent(start_time)}&end_time=${encodeURIComponent(end_time)}`;
      }

      const data = await fetchJson<{
        matrix: Array<{
          origin: string;
          destination: string;
          vehicle_count: number;
        }>;
      }>(path);

      const matrix = data.matrix || [];
      const total = matrix.reduce((sum, m) => sum + m.vehicle_count, 0);

      const records = matrix.map((m, i) => ({
        from_camera_id: m.origin,
        to_camera_id: m.destination,
        vehicle_count: m.vehicle_count,
        share_pct: total > 0 ? (m.vehicle_count / total) * 100 : 0,
        rank: i + 1,
      }));

      return { records, total };
    } catch (err) {
      console.error('Failed to fetch /analytics/od-matrix:', err);
      return { records: [], total: 0 };
    }
  },

  // 11. GET /analytics/anomalies/summary
  getAnomalySummary: async (): Promise<AnomalySummary> => {
    try {
      const data = await fetchJson<{
        anomalies: Array<{
          alert_type: string;
          total_alerts: number;
          active_alerts: number;
          high_alerts: number;
          medium_alerts: number;
          critical_alerts: number;
        }>;
      }>('/analytics/anomalies/summary');

      let route_anomalies = 0;
      let collective_movement_anomalies = 0;

      (data.anomalies || []).forEach((a) => {
        if (a.alert_type === 'ROUTE_DEVIATION') route_anomalies += a.active_alerts;
        if (a.alert_type === 'COLLECTIVE_MOVEMENT') collective_movement_anomalies += a.active_alerts;
      });

      return {
        route_anomalies,
        collective_movement_anomalies,
      };
    } catch (err) {
      console.error('Failed to fetch /analytics/anomalies/summary:', err);
      return {};
    }
  },

  // 12. GET /vehicles/{vehicle_id}/trajectory
  getVehicleTrajectory: async (vehicleId: string, _params?: string): Promise<VehicleTrajectory | null> => {
    try {
      // Backend expects integer vehicle_id
      const numericId = parseInt(vehicleId.replace(/\D/g, ''), 10);
      if (isNaN(numericId)) {
        return null;
      }

      const data = await fetchJson<{
        vehicle_id: number;
        trajectory: Array<{
          trajectory_id: number;
          vehicle_id: number;
          from_camera_id: string;
          to_camera_id: string;
          started_at: string;
          ended_at: string;
          travel_time_seconds: number;
          distance_m: number;
          road_sequence: any;
          geometry: any;
          inference_method: string;
          confidence: number | null;
        }>;
      }>(`/vehicles/${numericId}/trajectory`);

      const trajectoryList = data.trajectory || [];
      if (trajectoryList.length === 0) return null;

      const events = trajectoryList.map((seg) => {
        let lat: number | undefined;
        let lng: number | undefined;
        if (seg.geometry && seg.geometry.coordinates && Array.isArray(seg.geometry.coordinates)) {
          lng = seg.geometry.coordinates[0][0];
          lat = seg.geometry.coordinates[0][1];
        }

        return {
          event_id: seg.trajectory_id,
          camera_id: seg.from_camera_id,
          timestamp: seg.started_at,
          lat,
          lng,
          confidence: seg.confidence ?? undefined,
          plate: String(seg.vehicle_id),
        };
      });

      // Add last ending camera as final trajectory point
      const lastSeg = trajectoryList[trajectoryList.length - 1];
      if (lastSeg) {
        let lastLat: number | undefined;
        let lastLng: number | undefined;
        if (lastSeg.geometry && lastSeg.geometry.coordinates && Array.isArray(lastSeg.geometry.coordinates)) {
          const coords = lastSeg.geometry.coordinates;
          lastLng = coords[coords.length - 1][0];
          lastLat = coords[coords.length - 1][1];
        }
        events.push({
          event_id: lastSeg.trajectory_id * 1000 + 1,
          camera_id: lastSeg.to_camera_id,
          timestamp: lastSeg.ended_at,
          lat: lastLat,
          lng: lastLng,
          confidence: lastSeg.confidence ?? undefined,
          plate: String(lastSeg.vehicle_id),
        });
      }

      const totalDistanceKm = trajectoryList.reduce((acc, seg) => acc + (seg.distance_m || 0), 0) / 1000;

      return {
        vehicle_id: String(data.vehicle_id),
        events,
        total_observations: events.length,
        first_seen: trajectoryList[0]?.started_at,
        last_seen: lastSeg?.ended_at,
        first_camera: trajectoryList[0]?.from_camera_id,
        last_camera: lastSeg?.to_camera_id,
        total_distance: totalDistanceKm,
      };
    } catch (err) {
      console.warn(`No trajectory for vehicle ${vehicleId}:`, err);
      return null;
    }
  },

  // 13. GET /system/health (Comprehensive Observability)
  getDetailedSystemHealth: async (): Promise<DetailedSystemHealth | null> => {
    try {
      return await fetchJson<DetailedSystemHealth>('/system/health');
    } catch (err) {
      console.error('Failed to fetch /system/health:', err);
      return null;
    }
  },

  // 14. GET /cameras/{camera_id}/detail
  getCameraDetail: async (cameraId: string): Promise<CameraDetail | null> => {
    try {
      return await fetchJson<CameraDetail>(`/cameras/${encodeURIComponent(cameraId)}/detail`);
    } catch (err) {
      console.error(`Failed to fetch /cameras/${cameraId}/detail:`, err);
      return null;
    }
  },

  // 15. GET /vehicles/search?q={query}
  searchVehicles: async (q: string): Promise<VehicleSearchItem[]> => {
    try {
      const clean = q.trim();
      if (!clean) return [];
      const data = await fetchJson<{ query: string; results: VehicleSearchItem[] }>(
        `/vehicles/search?q=${encodeURIComponent(clean)}`
      );
      return data.results || [];
    } catch (err) {
      console.error('Failed to search vehicles:', err);
      return [];
    }
  },

  // 16. GET /vehicles/{vehicle_id}/trajectory/enhanced
  getEnhancedVehicleTrajectory: async (
    vehicleId: number | string,
    startTime?: string,
    endTime?: string
  ): Promise<EnhancedVehicleTrajectory | null> => {
    try {
      const numericId = typeof vehicleId === 'number' ? vehicleId : parseInt(String(vehicleId).replace(/\D/g, ''), 10);
      if (isNaN(numericId)) return null;

      let query = '';
      if (startTime && endTime) {
        query = `?start_time=${encodeURIComponent(startTime)}&end_time=${encodeURIComponent(endTime)}`;
      }
      return await fetchJson<EnhancedVehicleTrajectory>(`/vehicles/${numericId}/trajectory/enhanced${query}`);
    } catch (err) {
      console.error(`Failed to fetch enhanced trajectory for ${vehicleId}:`, err);
      return null;
    }
  },

  // 17. GET /analytics/routes/{route_id}/comparison
  getRouteComparison: async (
    routeId: string,
    baselineType: 'same_time_yesterday' | 'same_time_last_week' | 'previous_period' = 'same_time_yesterday',
    startTime?: string,
    endTime?: string
  ): Promise<RouteComparison | null> => {
    try {
      const params = new URLSearchParams({ baseline_type: baselineType });
      if (startTime) params.append('start_time', startTime);
      if (endTime) params.append('end_time', endTime);
      return await fetchJson<RouteComparison>(`/analytics/routes/${encodeURIComponent(routeId)}/comparison?${params.toString()}`);
    } catch (err) {
      console.error(`Failed to fetch comparison for route ${routeId}:`, err);
      return null;
    }
  },

  // 18. GET /watchlist
  getWatchlist: async (): Promise<WatchlistEntry[]> => {
    try {
      const data = await fetchJson<{ watchlist: WatchlistEntry[] }>('/watchlist');
      return data.watchlist || [];
    } catch (err) {
      console.error('Failed to fetch /watchlist:', err);
      return [];
    }
  },

  // 19. POST /watchlist
  addToWatchlist: async (entry: {
    plate_number: string;
    reason?: string;
    case_reference?: string;
    priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  }): Promise<{ message: string; watchlist_id?: number }> => {
    const res = await fetch(`${API_BASE_URL}/watchlist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-User-Role': 'Administrator',
      },
      body: JSON.stringify(entry),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Failed to add plate to watchlist: ${text}`);
    }
    return await res.json();
  },

  // 20. DELETE /watchlist/{plate_number}
  removeFromWatchlist: async (plateNumber: string): Promise<{ message: string }> => {
    const res = await fetch(`${API_BASE_URL}/watchlist/${encodeURIComponent(plateNumber)}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'X-User-Role': 'Administrator',
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Failed to remove plate from watchlist: ${text}`);
    }
    return await res.json();
  },

  // 21. GET /audit/logs
  getAuditLogs: async (limit = 50, offset = 0): Promise<AuditLogEntry[]> => {
    try {
      const data = await fetchJson<{ logs: AuditLogEntry[]; count: number }>(
        `/audit/logs?limit=${limit}&offset=${offset}`,
        {
          headers: { 'X-User-Role': 'Administrator' },
        }
      );
      return data.logs || [];
    } catch (err) {
      console.error('Failed to fetch /audit/logs:', err);
      return [];
    }
  },

  // 22. Get Export Download URL
  getExportUrl: (dataset: 'alerts' | 'od-matrix' | 'congestion-history' | 'camera-health', format: 'csv' | 'json' = 'csv', startTime?: string, endTime?: string): string => {
    const params = new URLSearchParams({ format });
    if (startTime) params.append('start_time', startTime);
    if (endTime) params.append('end_time', endTime);
    return `${API_BASE_URL}/export/${dataset}?${params.toString()}`;
  },
};
