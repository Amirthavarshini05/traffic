from pydantic import BaseModel
from typing import Any, Optional


class TrajectorySegment(BaseModel):

    trajectory_id: int

    vehicle_id: int

    from_camera_id: str

    to_camera_id: str

    started_at: Any

    ended_at: Any

    travel_time_seconds: float

    distance_m: float

    road_sequence: Optional[Any] = None

    geometry: Optional[Any] = None

    inference_method: str

    confidence: Optional[float] = None

    prev_trajectory_id: Optional[int] = None

    next_trajectory_id: Optional[int] = None


class VehicleTrajectoryResponse(BaseModel):

    vehicle_id: int

    trajectory: list[TrajectorySegment]

class ODMatrixEntry(BaseModel):
    origin: str
    destination: str
    vehicle_count: int


class ODMatrixResponse(BaseModel):
    matrix: list[ODMatrixEntry]

class HistoricalCongestionEntry(BaseModel):
    from_camera_id: str
    to_camera_id: str
    time_window_start: Any
    time_window_end: Any
    vehicle_count: int
    baseline_travel_time_seconds: float
    average_travel_time_seconds: float
    average_delay_seconds: float
    average_delay_percent: float
    congestion_level: str


class HistoricalCongestionResponse(BaseModel):
    congestion: list[HistoricalCongestionEntry]

class AlertEntry(BaseModel):

    alert_id: int

    alert_type: str

    severity: str

    message: str

    vehicle_id: Optional[int] = None

    road_id: Optional[str] = None

    camera_id: Optional[str] = None

    camera_name: Optional[str] = None

    zone_id: Optional[int] = None

    zone_name: Optional[str] = None

    authority_name: Optional[str] = None

    detected_at: Any

    resolved_at: Optional[Any] = None

    status: str

    metadata: Optional[Any] = None

    created_at: Any


class AlertsResponse(BaseModel):

    alerts: list[AlertEntry]

class CongestionPropagationEntry(BaseModel):

    propagation_id: int

    source_from_camera_id: str

    source_to_camera_id: str

    downstream_from_camera_id: str

    downstream_to_camera_id: str

    flow_probability_percent: Optional[float] = None

    source_congestion_level: Optional[str] = None

    propagation_score: Optional[float] = None

    propagation_level: Optional[str] = None

    estimated_impact_minutes: Optional[float] = None

    detected_at: Any

    status: str

    metadata: Optional[Any] = None

    created_at: Any

    updated_at: Any


class CongestionPropagationResponse(BaseModel):

    propagation: list[CongestionPropagationEntry]

class CameraHealthEntry(BaseModel):

    camera_id: str

    camera_name: str

    configured_status: str

    last_event_at: Optional[Any] = None

    health_status: str

    minutes_since_last_event: Optional[float] = None


class CameraHealthResponse(BaseModel):

    cameras: list[CameraHealthEntry]

class TrafficSummaryResponse(BaseModel):

    total_cameras: int

    healthy_cameras: int

    warning_cameras: int

    offline_cameras: int

    total_alerts: int

    active_alerts: int

    high_alerts: int

    medium_alerts: int

    critical_alerts: int

class ZoneTrafficEntry(BaseModel):

    zone_id: int

    zone_name: str

    authority_name: Optional[str] = None

    event_count: int

    vehicle_count: int


class ZoneTrafficResponse(BaseModel):

    zones: list[ZoneTrafficEntry]

class AuthorityAlertEntry(BaseModel):

    authority_name: str

    total_alerts: int

    active_alerts: int

    high_alerts: int

    medium_alerts: int

    critical_alerts: int


class AuthorityAlertsResponse(BaseModel):

    authorities: list[AuthorityAlertEntry]

class RouteTrafficEntry(BaseModel):

    from_camera_id: str

    to_camera_id: str

    trajectory_count: int

    vehicle_count: int

    average_travel_time_seconds: float


class RouteTrafficResponse(BaseModel):

    routes: list[RouteTrafficEntry]

class AnomalySummaryEntry(BaseModel):

    alert_type: str

    total_alerts: int

    active_alerts: int

    high_alerts: int

    medium_alerts: int

    critical_alerts: int


class AnomalySummaryResponse(BaseModel):

    anomalies: list[AnomalySummaryEntry]

class CameraEntry(BaseModel):
    camera_id: str
    camera_name: str
    status: str
    longitude: float
    latitude: float


class CamerasResponse(BaseModel):
    cameras: list[CameraEntry]    

class CameraRouteEntry(BaseModel):
    route_id: int
    starting_node: str
    ending_node: str
    total_distance_m: float
    geometry: Any


class CameraRoutesResponse(BaseModel):
    routes: list[CameraRouteEntry]