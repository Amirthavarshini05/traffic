import type { CongestionLevel, CameraHealth, AlertSeverity, SystemStatus } from '@/types';

export const API_BASE_URL = 'http://127.0.0.1:8000';
export const WS_URL = 'ws://127.0.0.1:8000/ws/traffic';

export const CITY_CENTER: [number, number] = [80.23, 13.04];
export const DEFAULT_ZOOM = 12;

export const CONGESTION_COLORS: Record<CongestionLevel, string> = {
  NONE: '#22C55E',
  LOW: '#22C55E',
  MODERATE: '#F59E0B',
  HIGH: '#F59E0B',
  SEVERE: '#EF4444',
};

export const CAMERA_HEALTH_COLORS: Record<CameraHealth, string> = {
  HEALTHY: '#22C55E',
  WARNING: '#F59E0B',
  OFFLINE: '#EF4444',
  UNKNOWN: '#64748B',
};

export const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  CRITICAL: '#EF4444',
  HIGH: '#F59E0B',
  MEDIUM: '#5DA9FF',
  LOW: '#64748B',
};

export const SYSTEM_STATUS_COLORS: Record<SystemStatus, string> = {
  OPERATIONAL: '#22C55E',
  DEGRADED: '#F59E0B',
  OFFLINE: '#EF4444',
  UNKNOWN: '#64748B',
};

export const MAP_LAYERS = [
  { id: 'cameras', label: 'Camera Network', icon: 'Camera' },
  { id: 'camera-health', label: 'Camera Health', icon: 'Activity' },
  { id: 'routes', label: 'Road / Camera Routes', icon: 'Route' },
  { id: 'traffic-density', label: 'Traffic Density', icon: 'Layers' },
  { id: 'congestion', label: 'Congestion', icon: 'AlertTriangle' },
  { id: 'route-density', label: 'Route Density', icon: 'BarChart3' },
  { id: 'trajectory', label: 'Vehicle Trajectory', icon: 'Navigation' },
  { id: 'incidents', label: 'Incident / Alert', icon: 'Siren' },
  { id: 'od-flow', label: 'OD Flow', icon: 'GitBranch' },
] as const;

export type MapLayerId = (typeof MAP_LAYERS)[number]['id'];

export const MICROTEXT: Record<string, string> = {
  congestion: 'Indicates how much current travel time exceeds the historical expected travel time.',
  trafficDensity: 'Shows the concentration of observed vehicles across the road network.',
  routeAnomaly: 'Highlights movement or travel-time behavior that differs from the established route pattern.',
  vehicleTrajectory: 'Shows the sequence of observed camera detections for the selected vehicle.',
  odFlow: 'Shows how vehicles move from one camera/area to another during the selected period.',
  cameraHealth: 'Indicates whether recent observations are being received from this camera.',
  propagation: 'Shows how congestion from one area may spread to downstream areas.',
  prediction: 'Forecasts future congestion based on current and historical patterns.',
  rerouting: 'Suggests alternative routes and responsible authorities for active bottlenecks.',
  collectiveMovement: 'Detects when many vehicles deviate from historical movement patterns simultaneously.',
  avgSpeed: 'Mean speed of observed vehicles across the selected area or route.',
  avgTravelTime: 'Mean time vehicles take to travel between two observation points.',
  delay: 'Difference between current travel time and the historical expected travel time.',
  baselineTravelTime: 'The typical travel time for this route based on historical observations.',
  delayPct: 'Percentage by which current travel time exceeds the historical baseline.',
  vehicleCount: 'Number of distinct vehicles observed during the selected period.',
  trajectoryCount: 'Number of linked vehicle trajectories passing through this route.',
  outlier: 'This route shows metrics significantly outside expected ranges.',
  observedSegment: 'Confirmed camera-to-camera movement with timestamp evidence.',
  unknownInterval: 'Time gap between observations with no confirmed movement data.',
  evidenceVsInterpretation: 'Evidence shows confirmed sensor data. Interpretation explains what the pattern may imply.',
};

export const THEME_COLORS = {
  dark: {
    bgBase: '#0B1220',
    bgSurface: '#111A2B',
    bgElevated: '#162238',
    bgHover: '#1C2D48',
    border: '#26344A',
    borderSubtle: '#1E2A3D',
    borderStrong: '#33445F',
    textPrimary: '#F5F7FA',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    accent: '#2F80ED',
    accentLight: '#5DA9FF',
    accentDim: '#1B5DBE',
    mapBg: '#0B1220',
    mapTileOpacity: 0.15,
    routeColor: '#2F80ED',
    routeOpacity: 0.4,
    selectedRouteColor: '#5DA9FF',
    selectedRouteOpacity: 0.8,
    cameraRing: 'rgba(255,255,255,0.3)',
  },
  light: {
    bgBase: '#F1F5F9',
    bgSurface: '#FFFFFF',
    bgElevated: '#F8FAFC',
    bgHover: '#E2E8F0',
    border: '#CBD5E1',
    borderSubtle: '#E2E8F0',
    borderStrong: '#94A3B8',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
    accent: '#2563EB',
    accentLight: '#3B82F6',
    accentDim: '#1D4ED8',
    mapBg: '#E2E8F0',
    mapTileOpacity: 0.6,
    routeColor: '#3B82F6',
    routeOpacity: 0.5,
    selectedRouteColor: '#1D4ED8',
    selectedRouteOpacity: 0.9,
    cameraRing: 'rgba(0,0,0,0.2)',
  },
} as const;

export type ThemeName = keyof typeof THEME_COLORS;
