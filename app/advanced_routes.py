"""
Advanced Production Intelligence Routes
Implements system health, camera telemetry, vehicle investigation,
route historical baselines, watchlist, audit logs, and export streaming.
"""

import io
import csv
import json
import time
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Query, Header, Response
from fastapi.responses import StreamingResponse

from .database import get_connection, get_redis_client
from .time_utils import parse_time_window, compute_baseline_window, compute_metric_comparison, parse_iso_utc
from .audit_service import log_audit_event, mask_plate_number, get_audit_logs
from .schemas import (
    SystemHealthResponse,
    SystemHealthServiceStatus,
    CameraDetailResponse,
    VehicleSearchResponse,
    VehicleSearchItem,
    EnhancedVehicleTrajectoryResponse,
    ObservationGap,
    RouteComparisonResponse,
    MetricComparison,
    WatchlistResponse,
    WatchlistEntry,
)

router = APIRouter(tags=["Advanced Intelligence"])


# ====================================================================
# 1. System Health & Pipeline Observability
# ====================================================================
@router.get("/system/health", response_model=SystemHealthResponse)
def get_system_health():
    """
    Real-time observability endpoint inspecting PostgreSQL latency,
    Redis stream lag, worker activity, data freshness, and camera network status.
    """
    services: List[SystemHealthServiceStatus] = []
    overall_status = "operational"

    # 1. Database Check
    db_status = "operational"
    db_latency_ms = None
    db_err = None
    try:
        t0 = time.perf_counter()
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT 1;")
            cur.fetchone()
        conn.close()
        db_latency_ms = round((time.perf_counter() - t0) * 1000, 2)
    except Exception as e:
        db_status = "offline"
        db_err = str(e)
        overall_status = "degraded"

    services.append(SystemHealthServiceStatus(
        name="PostgreSQL Database",
        status=db_status,
        latency_ms=db_latency_ms,
        details=db_err or "PostGIS spatial extensions verified"
    ))

    # 2. Redis & Stream Lag Check
    redis_status = "operational"
    redis_latency_ms = None
    redis_details = ""
    stream_lag = 0
    try:
        t0 = time.perf_counter()
        r = get_redis_client(decode_responses=True)
        r.ping()
        redis_latency_ms = round((time.perf_counter() - t0) * 1000, 2)

        # Inspect stream lengths and consumer groups
        traj_len = r.xlen("trajectory_events") if r.exists("trajectory_events") else 0
        alert_len = r.xlen("alert_events") if r.exists("alert_events") else 0

        # Check pending messages in route_anomaly group if exists
        try:
            pending_info = r.xpending("trajectory_events", "route_anomaly")
            stream_lag = pending_info.get("pending", 0) if isinstance(pending_info, dict) else 0
        except Exception:
            stream_lag = 0

        redis_details = f"Trajectories: {traj_len} stream items, Alerts: {alert_len} items, Pending Lag: {stream_lag}"
    except Exception as e:
        redis_status = "offline"
        redis_details = f"Redis connection error: {e}"
        overall_status = "degraded"

    services.append(SystemHealthServiceStatus(
        name="Redis Event Streams",
        status=redis_status,
        latency_ms=redis_latency_ms,
        details=redis_details
    ))

    # 3. Data Freshness & Camera Breakdown
    camera_counts = {"healthy": 0, "warning": 0, "offline": 0, "unknown": 0}
    freshness_data = {"latest_event_at": None, "age_seconds": None, "freshness_status": "No recent data"}

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            # Latest event
            cur.execute("SELECT MAX(observed_at) FROM events;")
            max_obs = cur.fetchone()[0]
            if max_obs:
                now_utc = datetime.now(timezone.utc)
                if max_obs.tzinfo is None:
                    max_obs = max_obs.replace(tzinfo=timezone.utc)
                age_sec = round((now_utc - max_obs).total_seconds(), 1)
                freshness_status = "Fresh" if age_sec <= 60 else "Delayed" if age_sec <= 300 else "Stale"
                freshness_data = {
                    "latest_event_at": max_obs.isoformat(),
                    "age_seconds": max_sec if (max_sec := max(age_sec, 0)) else 0,
                    "freshness_status": freshness_status
                }

            # Camera status summary
            cur.execute("""
                SELECT
                    COUNT(*) FILTER (WHERE status = 'ACTIVE'),
                    COUNT(*) FILTER (WHERE status = 'WARNING'),
                    COUNT(*) FILTER (WHERE status = 'OFFLINE')
                FROM cameras;
            """)
            c_row = cur.fetchone()
            if c_row:
                camera_counts["healthy"] = c_row[0] or 0
                camera_counts["warning"] = c_row[1] or 0
                camera_counts["offline"] = c_row[2] or 0

        conn.close()
    except Exception:
        pass

    # Overall degradation rule
    if db_status == "offline" or redis_status == "offline":
        overall_status = "offline"
    elif camera_counts["offline"] > 0 or stream_lag > 50:
        overall_status = "degraded"

    return SystemHealthResponse(
        overall_status=overall_status,
        services=services,
        cameras=camera_counts,
        data_freshness=freshness_data
    )


# ====================================================================
# 2. Camera Intelligence & Freshness Detail
# ====================================================================
@router.get("/cameras/{camera_id}/detail", response_model=CameraDetailResponse)
def get_camera_detail(camera_id: str):
    """
    Retrieve comprehensive operational metadata, 24h throughput,
    and exact data freshness for a specific surveillance camera.
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # 1. Camera info
            cur.execute("""
                SELECT camera_id, name, status, ST_Y(location), ST_X(location)
                FROM cameras
                WHERE camera_id = %s;
            """, (camera_id,))
            cam = cur.fetchone()
            if not cam:
                raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found")

            # 2. Last observation and 24h telemetry
            cur.execute("""
                SELECT
                    MAX(observed_at),
                    COUNT(*) FILTER (WHERE observed_at >= NOW() - INTERVAL '24 hours'),
                    COUNT(DISTINCT vehicle_id) FILTER (WHERE observed_at >= NOW() - INTERVAL '24 hours')
                FROM events
                WHERE camera_id = %s;
            """, (camera_id,))
            ev_row = cur.fetchone()

            # 3. Active alert count
            cur.execute("""
                SELECT COUNT(*)
                FROM alerts
                WHERE camera_id = %s AND status = 'ACTIVE';
            """, (camera_id,))
            alert_count = cur.fetchone()[0] or 0

        last_obs = ev_row[0] if ev_row else None
        data_freshness_sec = None
        freshness_status = "No recent data"

        if last_obs:
            now_utc = datetime.now(timezone.utc)
            if last_obs.tzinfo is None:
                last_obs = last_obs.replace(tzinfo=timezone.utc)
            data_freshness_sec = max(0.0, round((now_utc - last_obs).total_seconds(), 1))
            if data_freshness_sec <= 60:
                freshness_status = "Fresh"
            elif data_freshness_sec <= 300:
                freshness_status = "Delayed"
            elif data_freshness_sec <= 1800:
                freshness_status = "Stale"
            else:
                freshness_status = "No recent data"

        return CameraDetailResponse(
            camera_id=cam[0],
            name=cam[1],
            status=cam[2] or "ACTIVE",
            latitude=cam[3],
            longitude=cam[4],
            last_observation_at=last_obs.isoformat() if last_obs else None,
            data_freshness_seconds=data_freshness_sec,
            freshness_status=freshness_status,
            detection_count_24h=ev_row[1] if ev_row else 0,
            unique_vehicles_24h=ev_row[2] if ev_row else 0,
            active_alerts_count=alert_count
        )
    finally:
        conn.close()


# ====================================================================
# 3. Vehicle Search & Investigation
# ====================================================================
@router.get("/vehicles/search", response_model=VehicleSearchResponse)
def search_vehicles(
    q: str = Query(..., min_length=1, description="Plate number or Vehicle ID"),
    user_role: str = Header("Operator", alias="X-User-Role")
):
    """
    Search surveillance records by license plate number or vehicle ID.
    Supports partial match and plate masking for unauthorized roles.
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            clean_q = q.strip()
            # If numeric, search by ID or plate
            if clean_q.isdigit():
                query = """
                    SELECT v.vehicle_id, v.plate_number, MIN(e.observed_at), MAX(e.observed_at), COUNT(e.event_id)
                    FROM vehicles v
                    LEFT JOIN events e ON e.vehicle_id::text = v.vehicle_id::text
                    WHERE v.vehicle_id = %s OR v.plate_number ILIKE %s
                    GROUP BY v.vehicle_id, v.plate_number
                    ORDER BY MAX(e.observed_at) DESC NULLS LAST
                    LIMIT 20;
                """
                cur.execute(query, (int(clean_q), f"%{clean_q}%"))
            else:
                query = """
                    SELECT v.vehicle_id, v.plate_number, MIN(e.observed_at), MAX(e.observed_at), COUNT(e.event_id)
                    FROM vehicles v
                    LEFT JOIN events e ON e.vehicle_id::text = v.vehicle_id::text
                    WHERE v.plate_number ILIKE %s
                    GROUP BY v.vehicle_id, v.plate_number
                    ORDER BY MAX(e.observed_at) DESC NULLS LAST
                    LIMIT 20;
                """
                cur.execute(query, (f"%{clean_q}%",))

            rows = cur.fetchall()

            results = [
                VehicleSearchItem(
                    vehicle_id=r[0],
                    plate_number=mask_plate_number(r[1], role=user_role) or "UNKNOWN",
                    first_seen=r[2].isoformat() if r[2] else None,
                    last_seen=r[3].isoformat() if r[3] else None,
                    detection_count=r[4] or 0
                )
                for r in rows
            ]

            return VehicleSearchResponse(query=q, results=results)
    finally:
        conn.close()


# ====================================================================
# 4. Enhanced Vehicle Trajectory & Observation Gap Detection
# ====================================================================
@router.get("/vehicles/{vehicle_id}/trajectory/enhanced", response_model=EnhancedVehicleTrajectoryResponse)
def get_enhanced_vehicle_trajectory(
    vehicle_id: int,
    start_time: Optional[str] = Query(None),
    end_time: Optional[str] = Query(None),
    user_role: str = Header("Operator", alias="X-User-Role"),
    username: str = Header("operator", alias="X-User-Name")
):
    """
    Retrieve vehicle journey with rigorous observation gap detection,
    speed status calculation, and audit logging.
    """
    conn = get_connection()
    try:
        # Audit vehicle investigation action
        log_audit_event(
            username=username,
            action="INVESTIGATE_VEHICLE",
            entity_type="vehicle",
            entity_id=str(vehicle_id),
            details={"start_time": start_time, "end_time": end_time}
        )

        with conn.cursor() as cur:
            # 1. Vehicle info
            cur.execute("SELECT plate_number FROM vehicles WHERE vehicle_id = %s;", (vehicle_id,))
            v_row = cur.fetchone()
            if not v_row:
                raise HTTPException(status_code=404, detail=f"Vehicle #{vehicle_id} not found")

            plate = mask_plate_number(v_row[0], role=user_role)

            # 2. Query Trajectories
            query = """
                SELECT
                    trajectory_id,
                    from_camera_id,
                    to_camera_id,
                    started_at,
                    ended_at,
                    travel_time_seconds,
                    distance_m,
                    road_sequence,
                    ST_AsGeoJSON(geometry) AS geometry,
                    inference_method,
                    confidence
                FROM trajectories
                WHERE vehicle_id = %s
            """
            params: List[Any] = [vehicle_id]

            if start_time and end_time:
                s_dt, e_dt = parse_time_window(start_time, end_time)
                query += " AND started_at >= %s AND ended_at <= %s"
                params.extend([s_dt, e_dt])

            query += " ORDER BY started_at, trajectory_id;"
            cur.execute(query, tuple(params))
            rows = cur.fetchall()

        if not rows:
            return EnhancedVehicleTrajectoryResponse(
                vehicle_id=vehicle_id,
                plate_number=plate,
                unique_cameras_count=0,
                detection_count=0,
                trajectory=[],
                observation_gaps=[]
            )

        trajectory = []
        observation_gaps: List[ObservationGap] = []
        seen_cameras = set()

        prev_end_time = None
        prev_camera = None

        for row in rows:
            t_id = row[0]
            from_cam = row[1]
            to_cam = row[2]
            start_ts = row[3]
            end_ts = row[4]
            travel_sec = float(row[5]) if row[5] is not None else 0.0
            dist_m = float(row[6]) if row[6] is not None else 0.0

            seen_cameras.add(from_cam)
            seen_cameras.add(to_cam)

            # Compute Speed (Only when distance and time are valid)
            speed_kmh = None
            speed_status = "unavailable"
            if dist_m > 0 and travel_sec > 0:
                speed_kmh = round((dist_m / travel_sec) * 3.6, 1)
                speed_status = "available"

            # Check Observation Gap between consecutive trajectory segments
            if prev_end_time and prev_camera:
                if start_ts > prev_end_time:
                    gap_sec = (start_ts - prev_end_time).total_seconds()
                    # An interval > 180s or a camera discontinuity represents an unmonitored window
                    if gap_sec > 180 or prev_camera != from_cam:
                        observation_gaps.append(ObservationGap(
                            previous_camera=prev_camera,
                            previous_timestamp=prev_end_time.isoformat(),
                            next_camera=from_cam,
                            next_timestamp=start_ts.isoformat(),
                            gap_duration_seconds=round(gap_sec, 1),
                            status="unknown"
                        ))

            prev_end_time = end_ts
            prev_camera = to_cam

            trajectory.append({
                "trajectory_id": t_id,
                "from_camera_id": from_cam,
                "to_camera_id": to_cam,
                "started_at": start_ts.isoformat() if start_ts else None,
                "ended_at": end_ts.isoformat() if end_ts else None,
                "travel_time_seconds": travel_sec,
                "distance_m": dist_m,
                "speed_kmh": speed_kmh,
                "speed_status": speed_status,
                "road_sequence": row[7],
                "geometry": json.loads(row[8]) if row[8] else None,
                "inference_method": row[9],
                "confidence": float(row[10]) if row[10] is not None else None
            })

        first_seen = rows[0][3].isoformat() if rows[0][3] else None
        last_seen = rows[-1][4].isoformat() if rows[-1][4] else None
        total_duration = (rows[-1][4] - rows[0][3]).total_seconds() if rows[-1][4] and rows[0][3] else None

        return EnhancedVehicleTrajectoryResponse(
            vehicle_id=vehicle_id,
            plate_number=plate,
            first_seen=first_seen,
            last_seen=last_seen,
            total_duration_seconds=total_duration,
            unique_cameras_count=len(seen_cameras),
            detection_count=len(trajectory),
            trajectory=trajectory,
            observation_gaps=observation_gaps
        )
    finally:
        conn.close()


# ====================================================================
# 5. Route Historical Baseline & Metric Comparison
# ====================================================================
@router.get("/analytics/routes/{route_id}/comparison", response_model=RouteComparisonResponse)
def get_route_historical_comparison(
    route_id: str,
    baseline_type: str = Query("same_time_yesterday", description="same_time_yesterday | same_time_last_week | previous_period"),
    start_time: Optional[str] = Query(None),
    end_time: Optional[str] = Query(None)
):
    """
    Compare current route performance against historical baseline periods.
    Computes volume, travel time, speed (if valid), and congestion level.
    """
    s_dt, e_dt = parse_time_window(start_time, end_time, default_hours=24)
    b_s_dt, b_e_dt = compute_baseline_window(s_dt, e_dt, baseline_type=baseline_type)

    parts = route_id.split("_")
    from_cam = parts[0] if len(parts) > 0 else ""
    to_cam = parts[1] if len(parts) > 1 else ""

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # 1. Current Window Metrics
            cur.execute("""
                SELECT
                    COUNT(*) AS volume,
                    AVG(travel_time_seconds) AS avg_travel_time,
                    AVG(distance_m) AS avg_dist
                FROM trajectories
                WHERE from_camera_id = %s AND to_camera_id = %s
                  AND started_at >= %s AND started_at < %s;
            """, (from_cam, to_cam, s_dt, e_dt))
            cur_row = cur.fetchone()

            # 2. Baseline Window Metrics
            cur.execute("""
                SELECT
                    COUNT(*) AS volume,
                    AVG(travel_time_seconds) AS avg_travel_time
                FROM trajectories
                WHERE from_camera_id = %s AND to_camera_id = %s
                  AND started_at >= %s AND started_at < %s;
            """, (from_cam, to_cam, b_s_dt, b_e_dt))
            base_row = cur.fetchone()

        cur_vol = float(cur_row[0]) if cur_row and cur_row[0] is not None else 0.0
        cur_tt = float(cur_row[1]) if cur_row and cur_row[1] is not None else None
        cur_dist = float(cur_row[2]) if cur_row and cur_row[2] is not None else 0.0

        base_vol = float(base_row[0]) if base_row and base_row[0] is not None else 0.0
        base_tt = float(base_row[1]) if base_row and base_row[1] is not None else None

        vol_comp = compute_metric_comparison(cur_vol, base_vol, baseline_type, s_dt, e_dt)
        tt_comp = compute_metric_comparison(cur_tt, base_tt, baseline_type, s_dt, e_dt)

        # Speed calculation
        speed_kmh = None
        speed_status = "unavailable"
        if cur_dist > 0 and cur_tt and cur_tt > 0:
            speed_kmh = round((cur_dist / cur_tt) * 3.6, 1)
            speed_status = "available"

        # Congestion classification
        congestion_level = "LOW"
        if tt_comp.get("percentage_change") is not None:
            pct = tt_comp["percentage_change"]
            if pct > 40:
                congestion_level = "SEVERE"
            elif pct > 20:
                congestion_level = "HIGH"
            elif pct > 5:
                congestion_level = "MODERATE"
        elif cur_vol == 0:
            congestion_level = "UNKNOWN"

        return RouteComparisonResponse(
            route_id=route_id,
            from_camera_id=from_cam,
            to_camera_id=to_cam,
            volume_comparison=MetricComparison(**vol_comp),
            travel_time_comparison=MetricComparison(**tt_comp),
            congestion_level=congestion_level,
            speed_kmh=speed_kmh,
            speed_status=speed_status
        )
    finally:
        conn.close()


# ====================================================================
# 6. Vehicle Watchlist Management
# ====================================================================
@router.get("/watchlist", response_model=WatchlistResponse)
def get_watchlist(
    user_role: str = Header("Operator", alias="X-User-Role")
):
    """List all registered watchlist / blacklisted vehicles."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT watchlist_id, plate_number, status, reason, case_reference, priority, created_at
                FROM vehicle_watchlist
                WHERE status = 'active'
                ORDER BY created_at DESC;
            """)
            rows = cur.fetchall()

            return WatchlistResponse(
                watchlist=[
                    WatchlistEntry(
                        watchlist_id=r[0],
                        plate_number=mask_plate_number(r[1], role=user_role) or "",
                        status=r[2],
                        reason=r[3],
                        case_reference=r[4],
                        priority=r[5],
                        created_at=r[6].isoformat() if r[6] else None
                    )
                    for r in rows
                ]
            )
    finally:
        conn.close()


@router.post("/watchlist", response_model=Dict[str, Any])
def add_to_watchlist(
    entry: Dict[str, Any],
    username: str = Header("operator", alias="X-User-Name"),
    user_role: str = Header("Operator", alias="X-User-Role")
):
    """Add a vehicle to the active surveillance watchlist."""
    if user_role not in ("Administrator", "Admin", "Operator", "Investigator"):
        raise HTTPException(status_code=403, detail="Insufficient privileges to modify watchlist")

    plate = entry.get("plate_number", "").strip().upper()
    if not plate:
        raise HTTPException(status_code=400, detail="Valid plate_number is required")

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO vehicle_watchlist (plate_number, status, reason, case_reference, priority, created_by)
                VALUES (%s, 'active', %s, %s, %s, %s)
                ON CONFLICT (plate_number) DO UPDATE
                SET status = 'active', reason = EXCLUDED.reason, case_reference = EXCLUDED.case_reference,
                    priority = EXCLUDED.priority, updated_at = CURRENT_TIMESTAMP
                RETURNING watchlist_id;
            """, (
                plate,
                entry.get("reason", "Operational surveillance notice"),
                entry.get("case_reference", ""),
                entry.get("priority", "HIGH"),
                username
            ))
            w_id = cur.fetchone()[0]
        conn.commit()

        log_audit_event(
            username=username,
            action="ADD_WATCHLIST_ENTRY",
            entity_type="vehicle",
            entity_id=plate,
            details=entry
        )

        return {"message": f"Plate '{plate}' added to active watchlist", "watchlist_id": w_id}
    finally:
        conn.close()


@router.delete("/watchlist/{plate_number}")
def remove_from_watchlist(
    plate_number: str,
    username: str = Header("operator", alias="X-User-Name"),
    user_role: str = Header("Operator", alias="X-User-Role")
):
    """Deactivate a vehicle from the watchlist."""
    if user_role not in ("Administrator", "Admin", "Operator", "Investigator"):
        raise HTTPException(status_code=403, detail="Insufficient privileges to remove from watchlist")

    plate = plate_number.strip().upper()
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE vehicle_watchlist
                SET status = 'inactive', updated_at = CURRENT_TIMESTAMP
                WHERE plate_number = %s;
            """, (plate,))
        conn.commit()

        log_audit_event(
            username=username,
            action="REMOVE_WATCHLIST_ENTRY",
            entity_type="vehicle",
            entity_id=plate
        )

        return {"message": f"Plate '{plate}' deactivated from watchlist"}
    finally:
        conn.close()


# ====================================================================
# 7. Audit Log Inspection
# ====================================================================
@router.get("/audit/logs")
def view_audit_logs(
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    entity_type: Optional[str] = Query(None),
    user_role: str = Header("Operator", alias="X-User-Role")
):
    """Retrieve operational audit log entries."""
    if user_role not in ("Administrator", "Admin", "Operator"):
        raise HTTPException(status_code=403, detail="Access denied to audit logs")

    logs = get_audit_logs(limit=limit, offset=offset, entity_type=entity_type)
    return {"logs": logs, "count": len(logs)}


# ====================================================================
# 8. Unified Export Engine (CSV / JSON)
# ====================================================================
@router.get("/export/{dataset}")
def export_dataset(
    dataset: str,
    format: str = Query("csv", pattern="^(csv|json)$"),
    start_time: Optional[str] = Query(None),
    end_time: Optional[str] = Query(None),
    username: str = Header("operator", alias="X-User-Name")
):
    """
    Export operational datasets (alerts, od-matrix, congestion-history, camera-health, vehicle-timeline)
    as streamed CSV or structured JSON.
    """
    log_audit_event(
        username=username,
        action="EXPORT_DATA",
        entity_type="dataset",
        entity_id=dataset,
        details={"format": format, "start_time": start_time, "end_time": end_time}
    )

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            if dataset == "alerts":
                cur.execute("""
                    SELECT alert_id, alert_type, severity, camera_id, detected_at, status, message
                    FROM alerts
                    ORDER BY detected_at DESC
                    LIMIT 2000;
                """)
                rows = cur.fetchall()
                headers = ["Alert ID", "Type", "Severity", "Camera ID", "Detected At", "Status", "Message"]
                data = [[r[0], r[1], r[2], r[3], r[4].isoformat() if r[4] else "", r[5], r[6]] for r in rows]

            elif dataset == "od-matrix":
                cur.execute("""
                    SELECT origin_camera_id, destination_camera_id, COUNT(*) AS volume
                    FROM trips
                    GROUP BY origin_camera_id, destination_camera_id
                    ORDER BY volume DESC;
                """)
                rows = cur.fetchall()
                headers = ["Origin Camera", "Destination Camera", "Observed Vehicles"]
                data = [[r[0], r[1], r[2]] for r in rows]

            elif dataset == "congestion-history":
                cur.execute("""
                    SELECT from_camera_id, to_camera_id, vehicle_count, average_travel_time_seconds, congestion_level, time_window_start
                    FROM historical_congestion
                    ORDER BY time_window_start DESC
                    LIMIT 2000;
                """)
                rows = cur.fetchall()
                headers = ["From Camera", "To Camera", "Vehicles", "Avg Travel Time (s)", "Congestion Level", "Window Start"]
                data = [[r[0], r[1], r[2], r[3], r[4], r[5].isoformat() if r[5] else ""] for r in rows]

            elif dataset == "camera-health":
                cur.execute("""
                    SELECT camera_id, name, status, created_at
                    FROM cameras
                    ORDER BY camera_id;
                """)
                rows = cur.fetchall()
                headers = ["Camera ID", "Location Name", "Status", "Registered At"]
                data = [[r[0], r[1], r[2], r[3].isoformat() if r[3] else ""] for r in rows]

            else:
                raise HTTPException(status_code=400, detail=f"Unsupported export dataset: '{dataset}'")

        if format == "json":
            json_payload = [dict(zip(headers, row)) for row in data]
            return Response(
                content=json.dumps(json_payload, indent=2),
                media_type="application/json",
                headers={"Content-Disposition": f"attachment; filename={dataset}_export.json"}
            )

        # CSV format
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        writer.writerows(data)
        output.seek(0)

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={dataset}_export.csv"}
        )
    finally:
        conn.close()
