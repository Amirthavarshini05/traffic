from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from .realtime import manager, redis_trajectory_listener
from fastapi.middleware.cors import CORSMiddleware
from .database import get_connection
from datetime import datetime, timezone
from typing import Optional
from .advanced_routes import router as advanced_router
from .schemas import (
    VehicleTrajectoryResponse,
    ODMatrixResponse,
    HistoricalCongestionResponse,
    AlertsResponse,
    CongestionPropagationResponse,
    CameraHealthResponse,
    TrafficSummaryResponse,
    ZoneTrafficResponse,
    AuthorityAlertsResponse,
    RouteTrafficResponse,
    AnomalySummaryResponse,
    CameraEntry,
    CamerasResponse,
    CameraRouteEntry,
    CameraRoutesResponse    
)
import json
import asyncio

app = FastAPI(title="City Traffic API")
app.include_router(advanced_router)

@app.on_event("startup")
async def startup_realtime_listener():
    asyncio.create_task(
        redis_trajectory_listener()
    )
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "City Traffic API is running"}


@app.get(
    "/vehicles/{vehicle_id}/trajectory",
    response_model=VehicleTrajectoryResponse
)
def get_vehicle_trajectory(vehicle_id: int):

    conn = get_connection()

    try:
        cursor = conn.cursor()

        query = """
            SELECT
                trajectory_id,
                vehicle_id,
                from_camera_id,
                to_camera_id,
                started_at,
                ended_at,
                travel_time_seconds,
                distance_m,
                road_sequence,
                ST_AsGeoJSON(geometry) AS geometry,
                inference_method,
                confidence,
                prev_trajectory_id,
                next_trajectory_id
            FROM trajectories
            WHERE vehicle_id = %s
            ORDER BY started_at, trajectory_id;
        """

        cursor.execute(query, (vehicle_id,))
        rows = cursor.fetchall()

        cursor.close()

    finally:
        conn.close()

    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"No trajectory found for vehicle {vehicle_id}"
        )

    trajectory = []

    for row in rows:
        trajectory.append({
            "trajectory_id": row[0],
            "vehicle_id": row[1],
            "from_camera_id": row[2],
            "to_camera_id": row[3],
            "started_at": row[4],
            "ended_at": row[5],
            "travel_time_seconds": float(row[6]),
            "distance_m": float(row[7]),
            "road_sequence": row[8],
            "geometry": json.loads(row[9]) if row[9] is not None else None,
            "inference_method": row[10],
            "confidence": float(row[11]) if row[11] is not None else None,
            "prev_trajectory_id": row[12],
            "next_trajectory_id": row[13]
        })

    return {
        "vehicle_id": vehicle_id,
        "trajectory": trajectory
    }


@app.get(
    "/analytics/od-matrix",
    response_model=ODMatrixResponse
)
def get_od_matrix(
    start_time: Optional[str] = Query(None),
    end_time: Optional[str] = Query(None),
    origin: Optional[str] = Query(None),
    destination: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0)
):

    conn = get_connection()

    try:
        cursor = conn.cursor()

        query = """
            SELECT
                origin_camera_id AS origin,
                destination_camera_id AS destination,
                COUNT(*) AS vehicle_count
            FROM trips
            WHERE 1=1
        """
        params = []
        if start_time:
            query += " AND started_at >= %s"
            params.append(start_time)
        if end_time:
            query += " AND started_at <= %s"
            params.append(end_time)
        if origin:
            query += " AND origin_camera_id = %s"
            params.append(origin)
        if destination:
            query += " AND destination_camera_id = %s"
            params.append(destination)

        query += """
            GROUP BY
                origin_camera_id,
                destination_camera_id
            ORDER BY
                vehicle_count DESC,
                origin_camera_id,
                destination_camera_id
            LIMIT %s OFFSET %s;
        """
        params.extend([limit, offset])

        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()

        cursor.close()

    finally:
        conn.close()

    matrix = []

    for row in rows:
        matrix.append({
            "origin": row[0],
            "destination": row[1],
            "vehicle_count": row[2]
        })

    return {
        "matrix": matrix
    }


@app.get(
    "/analytics/od-matrix/history",
    response_model=ODMatrixResponse
)
def get_historical_od_matrix(
    start_time: str = Query(..., description="Start of time range"),
    end_time: str = Query(..., description="End of time range")
):

    conn = get_connection()

    try:
        cursor = conn.cursor()

        query = """
            SELECT
                origin_camera_id AS origin,
                destination_camera_id AS destination,
                COUNT(*) AS vehicle_count
            FROM trips
            WHERE started_at >= %s
              AND started_at < %s
            GROUP BY
                origin_camera_id,
                destination_camera_id
            ORDER BY
                origin_camera_id,
                destination_camera_id;
        """

        cursor.execute(query, (start_time, end_time))
        rows = cursor.fetchall()

        cursor.close()

    finally:
        conn.close()

    matrix = []

    for row in rows:
        matrix.append({
            "origin": row[0],
            "destination": row[1],
            "vehicle_count": row[2]
        })

    return {
        "matrix": matrix
    }

@app.get(
    "/analytics/congestion/history",
    response_model=HistoricalCongestionResponse
)
def get_historical_congestion(
    start_time: str = Query(..., description="Start of time range"),
    end_time: str = Query(..., description="End of time range")
):

    conn = get_connection()

    try:
        cursor = conn.cursor()

        query = """
            SELECT
                from_camera_id,
                to_camera_id,
                time_window_start,
                time_window_end,
                vehicle_count,
                baseline_travel_time_seconds,
                average_travel_time_seconds,
                average_delay_seconds,
                average_delay_percent,
                congestion_level
            FROM historical_congestion
            WHERE time_window_start >= %s
              AND time_window_end <= %s
            ORDER BY
                time_window_start,
                from_camera_id,
                to_camera_id;
        """

        cursor.execute(query, (start_time, end_time))
        rows = cursor.fetchall()

        cursor.close()

    finally:
        conn.close()

    congestion = []

    for row in rows:
        congestion.append({
            "from_camera_id": row[0],
            "to_camera_id": row[1],
            "time_window_start": row[2],
            "time_window_end": row[3],
            "vehicle_count": row[4],
            "baseline_travel_time_seconds": float(row[5]),
            "average_travel_time_seconds": float(row[6]),
            "average_delay_seconds": float(row[7]),
            "average_delay_percent": float(row[8]),
            "congestion_level": row[9]
        })

    return {
        "congestion": congestion
    }

@app.get(
    "/alerts",
    response_model=AlertsResponse
)
def get_alerts(
    severity: Optional[str] = Query(None),
    alert_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    camera_id: Optional[str] = Query(None),
    vehicle_id: Optional[int] = Query(None),
    start_time: Optional[str] = Query(None),
    end_time: Optional[str] = Query(None),
    limit: int = Query(100, le=1000),
    offset: int = Query(0)
):

    conn = get_connection()

    try:
        cursor = conn.cursor()

        query = """
            SELECT
                a.alert_id,
                a.alert_type,
                a.severity,
                a.message,
                a.vehicle_id,
                a.road_id,
                a.camera_id,
                c.name AS camera_name,
                z.zone_id,
                z.name AS zone_name,
                COALESCE(z.authority_name, 'UNASSIGNED') AS authority_name,
                a.detected_at,
                a.resolved_at,
                a.status,
                a.metadata,
                a.created_at

            FROM alerts a

            LEFT JOIN cameras c
                ON c.camera_id = a.camera_id

            LEFT JOIN zones z
                ON ST_Within(c.location, z.boundary)

            WHERE 1=1
        """
        params = []
        if severity:
            query += " AND a.severity = %s"
            params.append(severity)
        if alert_type:
            query += " AND a.alert_type = %s"
            params.append(alert_type)
        if status:
            query += " AND a.status = %s"
            params.append(status)
        if camera_id:
            query += " AND a.camera_id = %s"
            params.append(camera_id)
        if vehicle_id:
            query += " AND a.vehicle_id = %s"
            params.append(vehicle_id)
        if start_time:
            query += " AND a.detected_at >= %s"
            params.append(start_time)
        if end_time:
            query += " AND a.detected_at <= %s"
            params.append(end_time)

        query += """
            ORDER BY
                a.detected_at DESC,
                a.alert_id DESC
            LIMIT %s OFFSET %s;
        """
        params.extend([limit, offset])

        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()

        cursor.close()

    finally:
        conn.close()

    alerts = []

    for row in rows:

        alerts.append({
            "alert_id": row[0],
            "alert_type": row[1],
            "severity": row[2],
            "message": row[3],
            "vehicle_id": row[4],
            "road_id": row[5],
            "camera_id": row[6],
            "camera_name": row[7],
            "zone_id": row[8],
            "zone_name": row[9],
            "authority_name": row[10],
            "detected_at": row[11],
            "resolved_at": row[12],
            "status": row[13],
            "metadata": row[14],
            "created_at": row[15]
        })

    return {
        "alerts": alerts
    }

@app.get(
    "/analytics/congestion/propagation",
    response_model=CongestionPropagationResponse
)
def get_congestion_propagation():

    conn = get_connection()

    try:
        cursor = conn.cursor()

        query = """
            SELECT
                propagation_id,
                source_from_camera_id,
                source_to_camera_id,
                downstream_from_camera_id,
                downstream_to_camera_id,
                flow_probability_percent,
                source_congestion_level,
                propagation_score,
                propagation_level,
                estimated_impact_minutes,
                detected_at,
                status,
                metadata,
                created_at,
                updated_at
            FROM congestion_propagation
            ORDER BY detected_at DESC, propagation_id DESC;
        """

        cursor.execute(query)
        rows = cursor.fetchall()

        cursor.close()

    finally:
        conn.close()

    propagation = []

    for row in rows:

        propagation.append({
            "propagation_id": row[0],
            "source_from_camera_id": row[1],
            "source_to_camera_id": row[2],
            "downstream_from_camera_id": row[3],
            "downstream_to_camera_id": row[4],
            "flow_probability_percent": (
                float(row[5]) if row[5] is not None else None
            ),
            "source_congestion_level": row[6],
            "propagation_score": (
                float(row[7]) if row[7] is not None else None
            ),
            "propagation_level": row[8],
            "estimated_impact_minutes": (
                float(row[9]) if row[9] is not None else None
            ),
            "detected_at": row[10],
            "status": row[11],
            "metadata": row[12],
            "created_at": row[13],
            "updated_at": row[14]
        })

    return {
        "propagation": propagation
    }

@app.get(
    "/cameras/health",
    response_model=CameraHealthResponse
)
def get_camera_health():

    conn = get_connection()

    try:
        cursor = conn.cursor()

        query = """
            SELECT
                c.camera_id,
                c.name,
                c.status AS configured_status,
                MAX(e.observed_at) AS last_event_at
            FROM cameras c
            LEFT JOIN events e
                ON e.camera_id = c.camera_id
            GROUP BY
                c.camera_id,
                c.name,
                c.status
            ORDER BY
                c.camera_id;
        """

        cursor.execute(query)
        rows = cursor.fetchall()

        cursor.close()

    finally:
        conn.close()

    # Use the actual current server time for the API.
    # Use the latest event timestamp as the reference time.
        # This keeps synthetic/historical traffic data consistent.
        reference_time = max(
            (
                row[3]
                for row in rows
                if row[3] is not None
            ),
            default=None
        )

        if reference_time is None:
            reference_time = datetime.now(timezone.utc)
    cameras = []

    for row in rows:

        camera_id = row[0]
        camera_name = row[1]
        configured_status = row[2]
        last_event_at = row[3]

        if last_event_at is None:

            health_status = "OFFLINE"
            minutes_since_last_event = None

        else:

            seconds_since_event = (
                reference_time - last_event_at
            ).total_seconds()

            minutes_since_last_event = (
                seconds_since_event / 60
            )

            if minutes_since_last_event <= 5:
                health_status = "HEALTHY"

            elif minutes_since_last_event <= 15:
                health_status = "WARNING"

            else:
                health_status = "OFFLINE"

        cameras.append({
            "camera_id": camera_id,
            "camera_name": camera_name,
            "configured_status": configured_status,
            "last_event_at": last_event_at,
            "health_status": health_status,
            "minutes_since_last_event": (
                round(minutes_since_last_event, 2)
                if minutes_since_last_event is not None
                else None
            )
        })

    return {
        "cameras": cameras
    }

@app.get(
    "/analytics/summary",
    response_model=TrafficSummaryResponse
)
def get_traffic_summary():

    conn = get_connection()

    try:
        cursor = conn.cursor()

        # --------------------------------------------------
        # Camera summary
        # --------------------------------------------------

        camera_query = """
            SELECT
                COUNT(*) AS total_cameras,

                COUNT(*) FILTER (
                    WHERE last_event_at IS NOT NULL
                      AND EXTRACT(
                          EPOCH FROM (CURRENT_TIMESTAMP - last_event_at)
                      ) / 60 <= 5
                ) AS healthy_cameras,

                COUNT(*) FILTER (
                    WHERE last_event_at IS NOT NULL
                      AND EXTRACT(
                          EPOCH FROM (CURRENT_TIMESTAMP - last_event_at)
                      ) / 60 > 5
                      AND EXTRACT(
                          EPOCH FROM (CURRENT_TIMESTAMP - last_event_at)
                      ) / 60 <= 15
                ) AS warning_cameras,

                COUNT(*) FILTER (
                    WHERE last_event_at IS NULL
                       OR EXTRACT(
                           EPOCH FROM (CURRENT_TIMESTAMP - last_event_at)
                       ) / 60 > 15
                ) AS offline_cameras

            FROM (
                SELECT
                    c.camera_id,
                    MAX(e.observed_at) AS last_event_at
                FROM cameras c
                LEFT JOIN events e
                    ON e.camera_id = c.camera_id
                GROUP BY c.camera_id
            ) camera_status;
        """

        cursor.execute(camera_query)

        camera_row = cursor.fetchone()

        # --------------------------------------------------
        # Alert summary
        # --------------------------------------------------

        alert_query = """
            SELECT
                COUNT(*) AS total_alerts,

                COUNT(*) FILTER (
                    WHERE status = 'ACTIVE'
                ) AS active_alerts,

                COUNT(*) FILTER (
                    WHERE status = 'ACTIVE'
                      AND severity = 'HIGH'
                ) AS high_alerts,

                COUNT(*) FILTER (
                    WHERE status = 'ACTIVE'
                      AND severity = 'MEDIUM'
                ) AS medium_alerts,

                COUNT(*) FILTER (
                    WHERE status = 'ACTIVE'
                      AND severity = 'CRITICAL'
                ) AS critical_alerts

            FROM alerts;
        """

        cursor.execute(alert_query)

        alert_row = cursor.fetchone()

        cursor.close()

    finally:
        conn.close()

    return {
        "total_cameras": camera_row[0],
        "healthy_cameras": camera_row[1],
        "warning_cameras": camera_row[2],
        "offline_cameras": camera_row[3],
        "total_alerts": alert_row[0],
        "active_alerts": alert_row[1],
        "high_alerts": alert_row[2],
        "medium_alerts": alert_row[3],
        "critical_alerts": alert_row[4]
    }

@app.get(
    "/analytics/traffic/zones",
    response_model=ZoneTrafficResponse
)
def get_zone_traffic():

    conn = get_connection()

    try:
        cursor = conn.cursor()

        query = """
            SELECT
                z.zone_id,
                z.name AS zone_name,
                z.authority_name,
                COUNT(e.event_id) AS event_count,
                COUNT(DISTINCT e.vehicle_id) AS vehicle_count
            FROM zones z

            LEFT JOIN cameras c
                ON ST_Within(c.location, z.boundary)

            LEFT JOIN events e
                ON e.camera_id = c.camera_id

            GROUP BY
                z.zone_id,
                z.name,
                z.authority_name

            ORDER BY
                z.zone_id;
        """

        cursor.execute(query)
        rows = cursor.fetchall()

        cursor.close()

    finally:
        conn.close()

    zones = []

    for row in rows:

        zones.append({
            "zone_id": row[0],
            "zone_name": row[1],
            "authority_name": row[2],
            "event_count": row[3],
            "vehicle_count": row[4]
        })

    return {
        "zones": zones
    }

@app.get(
    "/analytics/alerts/authorities",
    response_model=AuthorityAlertsResponse
)
def get_authority_alert_summary():

    conn = get_connection()

    try:
        cursor = conn.cursor()

        query = """
            SELECT
                COALESCE(
                    z.authority_name,
                    'UNASSIGNED'
                ) AS authority_name,

                COUNT(*) AS total_alerts,

                COUNT(*) FILTER (
                    WHERE a.status = 'ACTIVE'
                ) AS active_alerts,

                COUNT(*) FILTER (
                    WHERE a.status = 'ACTIVE'
                      AND a.severity = 'HIGH'
                ) AS high_alerts,

                COUNT(*) FILTER (
                    WHERE a.status = 'ACTIVE'
                      AND a.severity = 'MEDIUM'
                ) AS medium_alerts,

                COUNT(*) FILTER (
                    WHERE a.status = 'ACTIVE'
                      AND a.severity = 'CRITICAL'
                ) AS critical_alerts

            FROM alerts a

            LEFT JOIN cameras c
                ON c.camera_id = a.camera_id

            LEFT JOIN zones z
                ON ST_Within(
                    c.location,
                    z.boundary
                )

            GROUP BY
                COALESCE(
                    z.authority_name,
                    'UNASSIGNED'
                )

            ORDER BY
                authority_name;
        """

        cursor.execute(query)
        rows = cursor.fetchall()

        cursor.close()

    finally:
        conn.close()

    authorities = []

    for row in rows:

        authorities.append({
            "authority_name": row[0],
            "total_alerts": row[1],
            "active_alerts": row[2],
            "high_alerts": row[3],
            "medium_alerts": row[4],
            "critical_alerts": row[5]
        })

    return {
        "authorities": authorities
    }

@app.get(
    "/analytics/traffic/routes",
    response_model=RouteTrafficResponse
)
def get_route_traffic():

    conn = get_connection()

    try:
        cursor = conn.cursor()

        query = """
            SELECT
                from_camera_id,
                to_camera_id,
                COUNT(*) AS trajectory_count,
                COUNT(DISTINCT vehicle_id) AS vehicle_count,
                ROUND(
                    AVG(travel_time_seconds),
                    2
                ) AS average_travel_time_seconds
            FROM trajectories
            GROUP BY
                from_camera_id,
                to_camera_id
            ORDER BY
                vehicle_count DESC,
                from_camera_id,
                to_camera_id;
        """

        cursor.execute(query)
        rows = cursor.fetchall()

        cursor.close()

    finally:
        conn.close()

    routes = []

    for row in rows:

        routes.append({
            "from_camera_id": row[0],
            "to_camera_id": row[1],
            "trajectory_count": row[2],
            "vehicle_count": row[3],
            "average_travel_time_seconds": float(row[4])
        })

    return {
        "routes": routes
    }
@app.get(
    "/analytics/anomalies/summary",
    response_model=AnomalySummaryResponse
)
def get_anomaly_summary():

    conn = get_connection()

    try:
        cursor = conn.cursor()

        query = """
            SELECT
                alert_type,
                COUNT(*) AS total_alerts,

                COUNT(*) FILTER (
                    WHERE status = 'ACTIVE'
                ) AS active_alerts,

                COUNT(*) FILTER (
                    WHERE severity = 'HIGH'
                ) AS high_alerts,

                COUNT(*) FILTER (
                    WHERE severity = 'MEDIUM'
                ) AS medium_alerts,

                COUNT(*) FILTER (
                    WHERE severity = 'CRITICAL'
                ) AS critical_alerts

            FROM alerts

            WHERE alert_type IN (
                'ROUTE_DEVIATION',
                'COLLECTIVE_MOVEMENT'
            )

            GROUP BY alert_type

            ORDER BY alert_type;
        """

        cursor.execute(query)
        rows = cursor.fetchall()

        cursor.close()

    finally:
        conn.close()

    anomalies = []

    for row in rows:

        anomalies.append({
            "alert_type": row[0],
            "total_alerts": row[1],
            "active_alerts": row[2],
            "high_alerts": row[3],
            "medium_alerts": row[4],
            "critical_alerts": row[5]
        })

    return {
        "anomalies": anomalies
    }

@app.get(
    "/cameras",
    response_model=CamerasResponse
)
def get_cameras():

    conn = get_connection()

    try:
        cursor = conn.cursor()

        query = """
            SELECT
                camera_id,
                name,
                status,
                ST_X(location) AS longitude,
                ST_Y(location) AS latitude
            FROM cameras
            ORDER BY camera_id;
        """

        cursor.execute(query)
        rows = cursor.fetchall()

        cursor.close()

    finally:
        conn.close()

    cameras = []

    for row in rows:

        cameras.append({
            "camera_id": row[0],
            "camera_name": row[1],
            "status": row[2],
            "longitude": float(row[3]),
            "latitude": float(row[4])
        })

    return {
        "cameras": cameras
    }

@app.get(
    "/camera-routes",
    response_model=CameraRoutesResponse
)
def get_camera_routes():

    conn = get_connection()

    try:
        cursor = conn.cursor()

        query = """
            SELECT
                route_id,
                starting_node,
                ending_node,
                total_distance_m,
                ST_AsGeoJSON(geometry) AS geometry
            FROM camera_routes
            ORDER BY route_id;
        """

        cursor.execute(query)
        rows = cursor.fetchall()

        cursor.close()

    finally:
        conn.close()

    routes = []

    for row in rows:

        routes.append({
            "route_id": row[0],
            "starting_node": row[1],
            "ending_node": row[2],
            "total_distance_m": float(row[3]),
            "geometry": json.loads(row[4])
        })

    return {
        "routes": routes
    }
@app.websocket("/ws/traffic")
async def traffic_websocket(websocket: WebSocket):

    await manager.connect(websocket)

    print("Dashboard WebSocket connected.")

    try:
        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:

        manager.disconnect(websocket)

        print("Dashboard WebSocket disconnected.")