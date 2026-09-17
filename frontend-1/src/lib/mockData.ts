import type {
  Camera,
  CameraRoute,
  CameraHealthResponse,
  Alert,
  AnalyticsSummary,
  AnomalySummary,
  RouteAnalyticsResponse,
  RouteAnalytics,
  ODMatrixResponse,
  ODRecord,
  ZoneTrafficResponse,
  ZoneTraffic,
  PropagationResponse,
  PropagationRecord,
  CongestionHistoryResponse,
  CongestionRecord,
  CongestionLevel,
  VehicleTrajectory,
  TrajectoryEvent,
  CameraHealth,
  AlertSeverity,
  AlertCategory,
  AlertStatus,
} from '@/types';

type Rng = () => number;
function seededRandom(seed: number): Rng {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

const ZONES = ['T. Nagar', 'Anna Nagar', 'Teynampet', 'Egmore', 'Mylapore', 'Velachery', 'Adyar', 'Guindy', 'Porur', 'Tambaram'];
const AUTHORITIES = ['Traffic Control South', 'Traffic Control North', 'Traffic Control East', 'Traffic Control West'];

function pick<T>(arr: T[], rng: Rng): T {
  return arr[Math.floor(rng() * arr.length)];
}

function congLevel(v: number): CongestionLevel {
  if (v < 0.2) return 'NONE';
  if (v < 0.4) return 'LOW';
  if (v < 0.6) return 'MODERATE';
  if (v < 0.8) return 'HIGH';
  return 'SEVERE';
}

// Chennai camera positions (approximate real intersections)
const CAMERA_POSITIONS: { id: string; name: string; lat: number; lng: number; zone: string }[] = [
  { id: 'CAM001', name: 'T. Nagar Junction', lat: 13.0418, lng: 80.2341, zone: 'T. Nagar' },
  { id: 'CAM002', name: 'Pondy Bazaar', lat: 13.0385, lng: 80.2335, zone: 'T. Nagar' },
  { id: 'CAM003', name: 'Anna Nagar Tower', lat: 13.0850, lng: 80.2101, zone: 'Anna Nagar' },
  { id: 'CAM004', name: 'Anna Nagar West', lat: 13.0892, lng: 80.2050, zone: 'Anna Nagar' },
  { id: 'CAM005', name: 'Teynampet Signal', lat: 13.0367, lng: 80.2200, zone: 'Teynampet' },
  { id: 'CAM006', name: 'Gemini Flyover', lat: 13.0406, lng: 80.2218, zone: 'Teynampet' },
  { id: 'CAM007', name: 'Egmore Station', lat: 13.0730, lng: 80.2600, zone: 'Egmore' },
  { id: 'CAM008', name: 'Egmore Bridge', lat: 13.0710, lng: 80.2630, zone: 'Egmore' },
  { id: 'CAM009', name: 'Mylapore Kapaleeshwarar', lat: 13.0330, lng: 80.2670, zone: 'Mylapore' },
  { id: 'CAM010', name: 'Mylapore Tank', lat: 13.0300, lng: 80.2640, zone: 'Mylapore' },
  { id: 'CAM011', name: 'Velachery Main', lat: 12.9790, lng: 80.2210, zone: 'Velachery' },
  { id: 'CAM012', name: 'Velachery Taramani', lat: 12.9750, lng: 80.2280, zone: 'Velachery' },
  { id: 'CAM013', name: 'Adyar Signal', lat: 13.0010, lng: 80.2560, zone: 'Adyar' },
  { id: 'CAM014', name: 'Adyar Signal 2', lat: 13.0060, lng: 80.2530, zone: 'Adyar' },
  { id: 'CAM015', name: 'Guindy Industrial', lat: 13.0100, lng: 80.2210, zone: 'Guindy' },
  { id: 'CAM016', name: 'Guindy Kathippara', lat: 13.0170, lng: 80.2210, zone: 'Guindy' },
  { id: 'CAM017', name: 'Porur Junction', lat: 13.0350, lng: 80.1580, zone: 'Porur' },
  { id: 'CAM018', name: 'Porur Shell', lat: 13.0320, lng: 80.1620, zone: 'Porur' },
  { id: 'CAM019', name: 'Tambaram Sanatorium', lat: 12.9250, lng: 80.1200, zone: 'Tambaram' },
  { id: 'CAM020', name: 'Tambaram Main', lat: 12.9370, lng: 80.1400, zone: 'Tambaram' },
  { id: 'CAM021', name: 'Marina Beach Rd', lat: 13.0500, lng: 80.2820, zone: 'Mylapore' },
  { id: 'CAM022', name: 'Triplicane', lat: 13.0560, lng: 80.2760, zone: 'Mylapore' },
  { id: 'CAM023', name: 'Royapettah', lat: 13.0520, lng: 80.2620, zone: 'Teynampet' },
  { id: 'CAM024', name: 'Saidapet', lat: 13.0220, lng: 80.2230, zone: 'Guindy' },
  { id: 'CAM025', name: 'West Mambalam', lat: 13.0400, lng: 80.2280, zone: 'T. Nagar' },
  { id: 'CAM026', name: 'Kodambakkam', lat: 13.0510, lng: 80.2230, zone: 'T. Nagar' },
  { id: 'CAM027', name: 'Nungambakkam', lat: 13.0600, lng: 80.2480, zone: 'Egmore' },
  { id: 'CAM028', name: 'Chetpet', lat: 13.0720, lng: 80.2450, zone: 'Egmore' },
  { id: 'CAM029', name: 'Kilpauk', lat: 13.0820, lng: 80.2420, zone: 'Egmore' },
  { id: 'CAM030', name: 'Aminjikarai', lat: 13.0860, lng: 80.2350, zone: 'Anna Nagar' },
  { id: 'CAM031', name: 'Shenoy Nagar', lat: 13.0820, lng: 80.2180, zone: 'Anna Nagar' },
  { id: 'CAM032', name: 'Arumbakkam', lat: 13.0760, lng: 80.2150, zone: 'Anna Nagar' },
  { id: 'CAM033', name: 'Vadapalani', lat: 13.0500, lng: 80.2120, zone: 'T. Nagar' },
  { id: 'CAM034', name: 'Ashok Pillar', lat: 13.0460, lng: 80.2090, zone: 'T. Nagar' },
  { id: 'CAM035', name: 'K.K. Nagar', lat: 13.0410, lng: 80.2000, zone: 'T. Nagar' },
];

const HEALTH_STATUSES: CameraHealth[] = ['HEALTHY', 'HEALTHY', 'HEALTHY', 'HEALTHY', 'HEALTHY', 'HEALTHY', 'WARNING', 'OFFLINE'];

const ALERT_TEMPLATES: { category: AlertCategory; title: string; message: string }[] = [
  { category: 'Camera Health', title: 'Camera CAM019 Offline', message: 'Camera at Tambaram Sanatorium has stopped sending observations. Last event 45 minutes ago.' },
  { category: 'Camera Health', title: 'Camera CAM008 Degraded', message: 'Camera at Egmore Bridge showing intermittent connectivity issues.' },
  { category: 'Route Anomaly', title: 'Unexpected Route: TN32 to ADY', message: 'Vehicle TN32AB9876 observed on unusual route from T. Nagar to Adyar, deviating from historical pattern.' },
  { category: 'Abnormal Travel Time', title: 'Travel Time Spike: Guindy-Velachery', message: 'Travel time on Guindy to Velachery route is 340% above baseline. Severe congestion detected.' },
  { category: 'Abnormal Travel Time', title: 'Travel Time Anomaly: Anna Nagar', message: 'Travel time on Anna Nagar West to Tower Park route is 180% above expected baseline.' },
  { category: 'Collective Movement', title: 'Collective Movement: Porur', message: '14 vehicles deviated from historical Porur route patterns in the last 30 minutes.' },
  { category: 'Collective Movement', title: 'Collective Movement: Tambaram', message: '9 vehicles showing unusual movement patterns near Tambaram corridor.' },
  { category: 'Blacklisted Vehicle', title: 'Blacklisted Vehicle: TN22XY4421', message: 'Flagged vehicle TN22XY4421 detected at CAM005 Teynampet Signal. Immediate attention required.' },
  { category: 'Blacklisted Vehicle', title: 'Blacklisted Vehicle: TN01AB1234', message: 'Flagged vehicle TN01AB1234 detected at CAM011 Velachery Main. Priority alert.' },
  { category: 'Route Anomaly', title: 'Route Anomaly: Egmore Loop', message: 'Vehicle TN14CD5678 completed an unexpected loop through Egmore station area.' },
  { category: 'Camera Health', title: 'Camera CAM014 Warning', message: 'Camera at Adyar Signal 2 reporting reduced detection accuracy.' },
  { category: 'Abnormal Travel Time', title: 'Travel Time Spike: T.Nagar-Kodambakkam', message: 'Travel time on T. Nagar to Kodambakkam route is 220% above baseline.' },
];

export function generateMockData(timeRange?: string) {
  const rangeKey = timeRange || 'range=1h';
  const seed = rangeKey.split('=')[1]?.charCodeAt(0) || 49;
  const rng = seededRandom(seed * 1000);

  // Cameras
  const cameras: Camera[] = CAMERA_POSITIONS.map((c) => ({
    camera_id: c.id,
    name: c.name,
    lat: c.lat,
    lng: c.lng,
    zone: c.zone,
    authority: pick(AUTHORITIES, rng),
    status: pick(HEALTH_STATUSES, rng),
    last_event: new Date(Date.now() - Math.floor(rng() * 600000)).toISOString(),
    last_event_time: new Date(Date.now() - Math.floor(rng() * 600000)).toISOString(),
  }));

  // Camera routes — connect nearby cameras
  const cameraRoutes: CameraRoute[] = [];
  for (let i = 0; i < cameras.length; i++) {
    const from = cameras[i];
    const distances = cameras
      .map((to, j) => ({ to, j, d: Math.hypot((to.lat ?? 0) - (from.lat ?? 0), (to.lng ?? 0) - (from.lng ?? 0)) }))
      .filter((x) => x.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
    for (const { to } of distances) {
      if (to.lat === undefined || to.lng === undefined || from.lat === undefined || from.lng === undefined) continue;
      cameraRoutes.push({
        route_id: `${from.camera_id}_${to.camera_id}`,
        from_camera_id: from.camera_id,
        to_camera_id: to.camera_id,
        from_camera_name: from.name,
        to_camera_name: to.name,
        from_lat: from.lat,
        from_lng: from.lng,
        to_lat: to.lat,
        to_lng: to.lng,
        route_name: `${from.name} → ${to.name}`,
      });
    }
  }

  // Camera health
  const healthCounts = { healthy: 0, warning: 0, offline: 0 };
  const healthCameras = cameras.map((c) => {
    const status = c.status || 'UNKNOWN';
    if (status === 'HEALTHY') healthCounts.healthy++;
    else if (status === 'WARNING') healthCounts.warning++;
    else if (status === 'OFFLINE') healthCounts.offline++;
    return {
      camera_id: c.camera_id,
      name: c.name,
      status,
      last_event: c.last_event,
      last_event_time: c.last_event_time,
      zone: c.zone,
      authority: c.authority,
    };
  });
  const cameraHealth: CameraHealthResponse = {
    total: cameras.length,
    healthy: healthCounts.healthy,
    warning: healthCounts.warning,
    offline: healthCounts.offline,
    cameras: healthCameras,
  };

  // Alerts
  const severities: AlertSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  const statuses: AlertStatus[] = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'];
  const alerts: Alert[] = ALERT_TEMPLATES.map((t, i) => {
    const cam = cameras[i % cameras.length];
    const minsAgo = Math.floor(rng() * 120);
    return {
      alert_id: `ALT${String(i + 1).padStart(4, '0')}`,
      severity: t.category === 'Blacklisted Vehicle' ? 'CRITICAL' : pick(severities, rng),
      category: t.category,
      title: t.title,
      vehicle_id: t.category === 'Blacklisted Vehicle' ? t.title.split(': ')[1] : t.category === 'Route Anomaly' ? `TN${String(Math.floor(rng() * 99)).padStart(2, '0')}AB${Math.floor(rng() * 9999)}` : undefined,
      camera_id: cam.camera_id,
      zone: cam.zone,
      authority: cam.authority,
      timestamp: new Date(Date.now() - minsAgo * 60000).toISOString(),
      message: t.message,
      status: pick(statuses, rng),
    };
  });

  // Route analytics
  const routeAnalytics: RouteAnalytics[] = cameraRoutes.slice(0, 40).map((r) => {
    const congestionVal = rng();
    const level = congLevel(congestionVal);
    const vehicleCount = Math.floor(rng() * 80) + 5;
    const baselineTT = 120 + rng() * 300;
    const avgTT = baselineTT * (1 + congestionVal * 0.8);
    const delay = avgTT - baselineTT;
    const delayPct = (delay / baselineTT) * 100;
    return {
      route_id: r.route_id,
      route_name: r.route_name,
      from_camera_id: r.from_camera_id,
      to_camera_id: r.to_camera_id,
      vehicle_count: vehicleCount,
      trajectory_count: Math.floor(vehicleCount * 0.7),
      avg_travel_time: avgTT,
      avg_speed: 15 + rng() * 45,
      congestion_level: level,
      delay,
      delay_pct: delayPct,
      baseline_travel_time: baselineTT,
      trend: rng() > 0.6 ? 'up' : rng() > 0.3 ? 'stable' : 'down',
      status: level === 'SEVERE' || level === 'HIGH' ? 'CONGESTED' : 'NORMAL',
      is_outlier: delayPct > 200,
    };
  });

  // OD matrix
  const odRecords: ODRecord[] = cameraRoutes.slice(0, 20).map((r, i) => ({
    from_camera_id: r.from_camera_id,
    to_camera_id: r.to_camera_id,
    from_camera_name: r.from_camera_name,
    to_camera_name: r.to_camera_name,
    vehicle_count: Math.floor(rng() * 60) + 5,
    share_pct: rng() * 30,
    rank: i + 1,
    time_range: rangeKey,
  }));
  const odMatrix: ODMatrixResponse = {
    records: odRecords.sort((a, b) => b.vehicle_count - a.vehicle_count),
    total: odRecords.reduce((s, r) => s + r.vehicle_count, 0),
  };

  // Zone traffic
  const zoneTraffic: ZoneTraffic[] = ZONES.map((zone) => {
    const zoneCams = cameras.filter((c) => c.zone === zone);
    const vCount = zoneCams.length * (10 + Math.floor(rng() * 40));
    return {
      zone,
      vehicle_count: vCount,
      density: vCount / (zoneCams.length || 1),
      avg_speed: 15 + rng() * 40,
      congestion_level: congLevel(rng()),
    };
  });
  const zoneTrafficResp: ZoneTrafficResponse = { zones: zoneTraffic };

  // Congestion history
  const histRecords: CongestionRecord[] = [];
  const hours = rangeKey.includes('7d') ? 24 : rangeKey.includes('1h') ? 6 : 12;
  for (let h = 0; h < hours; h++) {
    const route = cameraRoutes[Math.floor(rng() * cameraRoutes.length)];
    const congestionVal = rng();
    histRecords.push({
      route_id: route.route_id,
      route_name: route.route_name,
      from_camera_id: route.from_camera_id,
      to_camera_id: route.to_camera_id,
      timestamp: new Date(Date.now() - h * 3600000).toISOString(),
      time_window: `${h}h ago`,
      vehicle_count: Math.floor(rng() * 60) + 5,
      baseline_travel_time: 120 + rng() * 200,
      avg_travel_time: 120 + rng() * 400,
      delay: rng() * 200,
      delay_pct: rng() * 300,
      congestion_level: congLevel(congestionVal),
    });
  }
  const congestionHistory: CongestionHistoryResponse = { records: histRecords };

  // Propagation
  const propRecords: PropagationRecord[] = [];
  for (let i = 0; i < 8; i++) {
    const src = cameraRoutes[Math.floor(rng() * cameraRoutes.length)];
    const down = cameraRoutes[Math.floor(rng() * cameraRoutes.length)];
    if (src.route_id === down.route_id) continue;
    propRecords.push({
      source_route: src.route_name,
      from_camera_id: src.from_camera_id,
      to_camera_id: down.to_camera_id,
      downstream_route: down.route_name,
      probability: rng(),
      propagation_score: rng(),
      estimated_impact: pick(['LOW', 'MEDIUM', 'HIGH'], rng),
      detected_time: new Date(Date.now() - Math.floor(rng() * 3600000)).toISOString(),
      status: pick(['ACTIVE', 'MONITORING', 'RESOLVED'], rng),
    });
  }
  const propagation: PropagationResponse = { records: propRecords };

  // Analytics summary
  const activeAlerts = alerts.filter((a) => a.status === 'ACTIVE').length;
  const congestedRoutes = routeAnalytics.filter((r) => r.congestion_level === 'HIGH' || r.congestion_level === 'SEVERE').length;
  const totalVehicles = cameras.reduce((s) => s + Math.floor(rng() * 50) + 20, 0);
  const avgSpeed = routeAnalytics.reduce((s, r) => s + (r.avg_speed || 0), 0) / routeAnalytics.length;
  const summary: AnalyticsSummary = {
    total_vehicles: totalVehicles,
    active_cameras: cameraHealth.healthy,
    offline_cameras: cameraHealth.offline,
    active_alerts: activeAlerts,
    congested_routes: congestedRoutes,
    avg_speed: avgSpeed,
    active_anomalies: alerts.filter((a) => a.category !== 'Camera Health' && a.status === 'ACTIVE').length,
  };

  // Anomaly summary
  const anomalies: AnomalySummary = {
    route_anomalies: alerts.filter((a) => a.category === 'Route Anomaly').length,
    travel_time_anomalies: alerts.filter((a) => a.category === 'Abnormal Travel Time').length,
    collective_movement_anomalies: alerts.filter((a) => a.category === 'Collective Movement').length,
    blacklisted_vehicles: alerts.filter((a) => a.category === 'Blacklisted Vehicle').length,
    anomalies: [
      {
        type: 'Route Anomaly',
        vehicle_id: 'TN32AB9876',
        from_camera_id: 'CAM001',
        to_camera_id: 'CAM013',
        expected_route: 'T. Nagar → Saidapet → Adyar',
        observed_route: 'T. Nagar → Kodambakkam → Vadapalani → Guindy → Adyar',
        severity: 'HIGH',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
      },
      {
        type: 'Abnormal Travel Time',
        from_camera_id: 'CAM015',
        to_camera_id: 'CAM011',
        expected_travel_time: 480,
        actual_travel_time: 1620,
        deviation: '+237%',
        severity: 'CRITICAL',
        timestamp: new Date(Date.now() - 900000).toISOString(),
      },
      {
        type: 'Collective Movement',
        origin: 'Porur',
        destination: 'Guindy',
        current_share: 34,
        historical_share: 12,
        shift: 22,
        vehicles: 14,
        severity: 'HIGH',
        timestamp: new Date(Date.now() - 2400000).toISOString(),
      },
    ],
  };

  return {
    cameras,
    cameraRoutes,
    cameraHealth,
    alerts,
    summary,
    anomalies,
    routeAnalytics,
    odMatrix,
    zoneTraffic: zoneTrafficResp,
    propagation,
    congestionHistory,
  };
}

export function generateMockTrajectory(vehicleId: string): VehicleTrajectory {
  const rng = seededRandom(vehicleId.charCodeAt(0) * 100 + vehicleId.length);
  const numEvents = 4 + Math.floor(rng() * 5);
  const startIdx = Math.floor(rng() * (CAMERA_POSITIONS.length - numEvents));
  const events: TrajectoryEvent[] = [];
  let baseTime = Date.now() - 3600000;
  for (let i = 0; i < numEvents; i++) {
    const cam = CAMERA_POSITIONS[startIdx + i];
    baseTime += Math.floor(rng() * 600000) + 120000;
    events.push({
      event_id: i + 1,
      camera_id: cam.id,
      camera_name: cam.name,
      timestamp: new Date(baseTime).toISOString(),
      lat: cam.lat,
      lng: cam.lng,
      confidence: 0.7 + rng() * 0.3,
      plate: vehicleId,
    });
  }
  return {
    vehicle_id: vehicleId,
    events,
    total_observations: numEvents,
    first_seen: events[0]?.timestamp,
    last_seen: events[events.length - 1]?.timestamp,
    first_camera: events[0]?.camera_name,
    last_camera: events[events.length - 1]?.camera_name,
    total_distance: numEvents * (0.5 + rng() * 2),
  };
}
