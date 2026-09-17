export type CameraHealth = 'HEALTHY' | 'WARNING' | 'OFFLINE' | 'UNKNOWN';

export type CongestionLevel = 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type AlertCategory =
  | 'Camera Health'
  | 'Route Anomaly'
  | 'Abnormal Travel Time'
  | 'Collective Movement'
  | 'Blacklisted Vehicle';

export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

export type SystemStatus = 'OPERATIONAL' | 'DEGRADED' | 'OFFLINE' | 'UNKNOWN';

export interface Camera {
  camera_id: string;
  name?: string;
  lat?: number;
  lng?: number;
  zone?: string;
  authority?: string;
  status?: CameraHealth;
  last_event?: string;
  last_event_time?: string;
}

export interface CameraRoute {
  route_id: string;
  from_camera_id: string;
  to_camera_id: string;
  from_camera_name?: string;
  to_camera_name?: string;
  from_lat?: number;
  from_lng?: number;
  to_lat?: number;
  to_lng?: number;
  route_name?: string;
  geometry?: any;
}

export interface TrajectoryEvent {
  event_id: number;
  camera_id: string;
  camera_name?: string;
  timestamp: string;
  lat?: number;
  lng?: number;
  confidence?: number;
  plate?: string;
}

export interface VehicleTrajectory {
  vehicle_id: string;
  events: TrajectoryEvent[];
  total_observations?: number;
  first_seen?: string;
  last_seen?: string;
  first_camera?: string;
  last_camera?: string;
  total_distance?: number;
}

export interface Alert {
  alert_id: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  vehicle_id?: string;
  camera_id?: string;
  zone?: string;
  authority?: string;
  timestamp: string;
  message: string;
  status: AlertStatus;
}

export interface AnalyticsSummary {
  total_vehicles?: number;
  active_cameras?: number;
  offline_cameras?: number;
  active_alerts?: number;
  congested_routes?: number;
  avg_speed?: number;
  active_anomalies?: number;
}

export interface CongestionRecord {
  route_id?: string;
  route_name?: string;
  from_camera_id?: string;
  to_camera_id?: string;
  timestamp?: string;
  time_window?: string;
  vehicle_count?: number;
  baseline_travel_time?: number;
  avg_travel_time?: number;
  delay?: number;
  delay_pct?: number;
  congestion_level?: CongestionLevel;
}

export interface CongestionHistoryResponse {
  records: CongestionRecord[];
}

export interface PropagationRecord {
  source_route?: string;
  from_camera_id?: string;
  to_camera_id?: string;
  downstream_route?: string;
  probability?: number;
  propagation_score?: number;
  estimated_impact?: string;
  detected_time?: string;
  status?: string;
}

export interface PropagationResponse {
  records: PropagationRecord[];
}

export interface ZoneTraffic {
  zone?: string;
  camera_id?: string;
  vehicle_count?: number;
  density?: number;
  avg_speed?: number;
  congestion_level?: CongestionLevel;
}

export interface ZoneTrafficResponse {
  zones: ZoneTraffic[];
}

export interface RouteAnalytics {
  route_id: string;
  route_name?: string;
  from_camera_id?: string;
  to_camera_id?: string;
  vehicle_count?: number;
  trajectory_count?: number;
  avg_travel_time?: number;
  avg_speed?: number;
  congestion_level?: CongestionLevel;
  delay?: number;
  delay_pct?: number;
  baseline_travel_time?: number;
  trend?: 'up' | 'down' | 'stable';
  status?: string;
  is_outlier?: boolean;
}

export interface RouteAnalyticsResponse {
  routes: RouteAnalytics[];
}

export interface ODRecord {
  from_camera_id: string;
  to_camera_id: string;
  from_camera_name?: string;
  to_camera_name?: string;
  vehicle_count: number;
  share_pct?: number;
  rank?: number;
  time_range?: string;
}

export interface ODMatrixResponse {
  records: ODRecord[];
  total?: number;
}

export interface AnomalySummary {
  route_anomalies?: number;
  travel_time_anomalies?: number;
  collective_movement_anomalies?: number;
  blacklisted_vehicles?: number;
  anomalies?: AnomalyDetail[];
}

export interface AnomalyDetail {
  type: string;
  vehicle_id?: string;
  from_camera_id?: string;
  to_camera_id?: string;
  expected_route?: string;
  observed_route?: string;
  expected_travel_time?: number;
  actual_travel_time?: number;
  deviation?: string;
  severity?: AlertSeverity;
  timestamp?: string;
  origin?: string;
  destination?: string;
  current_share?: number;
  historical_share?: number;
  shift?: number;
  vehicles?: number;
}

export interface RealtimeEvent {
  trajectory_id: number;
  vehicle_id: string;
  from_camera_id: string;
  to_camera_id: string;
  start_event_id: number;
  end_event_id: number;
  event_type: string;
  timestamp?: string;
}

export interface CameraHealthRecord {
  camera_id: string;
  name?: string;
  status: CameraHealth;
  last_event?: string;
  last_event_time?: string;
  zone?: string;
  authority?: string;
}

export interface CameraHealthResponse {
  total?: number;
  healthy?: number;
  warning?: number;
  offline?: number;
  cameras: CameraHealthRecord[];
}

export interface PredictionData {
  route_id?: string;
  from_camera_id?: string;
  to_camera_id?: string;
  current_state?: CongestionLevel;
  predicted_state?: CongestionLevel;
  prediction_horizon?: string;
  confidence?: number;
  affected_route?: string;
  predicted_peak?: string;
}

export interface RecommendationData {
  bottleneck_route?: string;
  alternative_route?: string;
  recommendation?: string;
  assigned_authority?: string;
}

export interface SystemHealthStatus {
  api: SystemStatus;
  database: SystemStatus;
  redis: SystemStatus;
  realtime: SystemStatus;
  camera_network: SystemStatus;
}

export interface BlacklistedVehicle {
  plate?: string;
  vehicle_id?: string;
  first_detection?: string;
  last_detection?: string;
  camera_id?: string;
  zone?: string;
  timestamp?: string;
  status?: AlertStatus;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
}

// --- Advanced Intelligence Types ---

export interface SystemHealthServiceStatus {
  name: string;
  status: 'operational' | 'degraded' | 'offline';
  latency_ms?: number | null;
  details?: string | null;
}

export interface SystemHealthDataFreshness {
  latest_event_at?: string | null;
  age_seconds?: number | null;
  freshness_status: 'Fresh' | 'Delayed' | 'Stale' | 'No recent data';
}

export interface DetailedSystemHealth {
  overall_status: 'operational' | 'degraded' | 'offline';
  services: SystemHealthServiceStatus[];
  cameras: {
    healthy: number;
    warning: number;
    offline: number;
    unknown: number;
  };
  data_freshness: SystemHealthDataFreshness;
}

export interface CameraDetail {
  camera_id: string;
  name: string;
  status: string;
  latitude?: number;
  longitude?: number;
  last_observation_at?: string | null;
  data_freshness_seconds?: number | null;
  freshness_status: 'Fresh' | 'Delayed' | 'Stale' | 'No recent data';
  detection_count_24h: number;
  unique_vehicles_24h: number;
  active_alerts_count: number;
}

export interface VehicleSearchItem {
  vehicle_id: number;
  plate_number: string;
  first_seen?: string | null;
  last_seen?: string | null;
  detection_count: number;
}

export interface ObservationGap {
  previous_camera: string;
  previous_timestamp: string;
  next_camera: string;
  next_timestamp: string;
  gap_duration_seconds: number;
  status: 'unknown' | 'sparse' | 'unmonitored';
}

export interface EnhancedTrajectorySegment {
  trajectory_id: number;
  from_camera_id: string;
  to_camera_id: string;
  started_at?: string | null;
  ended_at?: string | null;
  travel_time_seconds: number;
  distance_m: number;
  speed_kmh?: number | null;
  speed_status: 'available' | 'unavailable';
  road_sequence?: any;
  geometry?: any;
  inference_method?: string;
  confidence?: number | null;
}

export interface EnhancedVehicleTrajectory {
  vehicle_id: number;
  plate_number: string;
  first_seen?: string | null;
  last_seen?: string | null;
  total_duration_seconds?: number | null;
  unique_cameras_count: number;
  detection_count: number;
  trajectory: EnhancedTrajectorySegment[];
  observation_gaps: ObservationGap[];
}

export interface MetricComparison {
  current_value?: number | null;
  baseline_value?: number | null;
  difference?: number | null;
  percentage_change?: number | null;
  baseline_type: string;
  period_start: string;
  period_end: string;
  status: 'available' | 'unavailable';
}

export interface RouteComparison {
  route_id: string;
  from_camera_id: string;
  to_camera_id: string;
  volume_comparison: MetricComparison;
  travel_time_comparison: MetricComparison;
  congestion_level: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE' | 'UNKNOWN';
  speed_kmh?: number | null;
  speed_status: 'available' | 'unavailable';
}

export interface WatchlistEntry {
  watchlist_id?: number;
  plate_number: string;
  status: 'active' | 'inactive';
  reason?: string;
  case_reference?: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  created_at?: string;
}

export interface AuditLogEntry {
  log_id: number;
  username: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details?: any;
  source_ip?: string;
  result: string;
  created_at?: string;
}

