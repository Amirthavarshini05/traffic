from app.database import get_connection
import json


# ---------------------------------------------------------
# Configuration
# ---------------------------------------------------------

TRAVEL_TIME_PERCENT = 20.0
MIN_SAMPLES_FOR_STATS = 5
SIGMA_MULTIPLIER = 2.0


# ---------------------------------------------------------
# Get abnormal travel-time bounds
# ---------------------------------------------------------

def get_travel_time_bounds(
    average_seconds,
    stddev_seconds,
    sample_count
):
    average_seconds = float(average_seconds)

    # Small sample:
    # use average +/- 20%
    if sample_count < MIN_SAMPLES_FOR_STATS:
        lower = average_seconds * 0.80
        upper = average_seconds * 1.20

        return max(lower, 0.0), upper

    # Enough samples but no standard deviation
    if stddev_seconds is None:
        lower = average_seconds * 0.80
        upper = average_seconds * 1.20

        return max(lower, 0.0), upper

    stddev_seconds = float(stddev_seconds)

    percentage_lower = average_seconds * 0.80
    percentage_upper = average_seconds * 1.20

    statistical_lower = (
        average_seconds
        - SIGMA_MULTIPLIER * stddev_seconds
    )

    statistical_upper = (
        average_seconds
        + SIGMA_MULTIPLIER * stddev_seconds
    )

    # Use the wider range
    lower = min(
        percentage_lower,
        statistical_lower
    )

    upper = max(
        percentage_upper,
        statistical_upper
    )

    return max(lower, 0.0), upper


# ---------------------------------------------------------
# Check whether predefined route exists
# ---------------------------------------------------------

# ---------------------------------------------------------
# Check whether predefined camera route exists
# ---------------------------------------------------------

def get_predefined_route_count(
    conn,
    from_camera,
    to_camera
):

    query = """
        SELECT COUNT(*)
        FROM camera_routes
        WHERE starting_node = %s
          AND ending_node = %s;
    """

    with conn.cursor() as cur:

        cur.execute(
            query,
            (
                from_camera,
                to_camera,
            )
        )

        row = cur.fetchone()

    return row[0] or 0
# ---------------------------------------------------------
# Get event sequences
# ---------------------------------------------------------

def get_event_sequences(conn):

    query = """
        WITH ordered_events AS (
            SELECT
                event_id,
                vehicle_id,
                camera_id,
                observed_at,

                LAG(camera_id) OVER (
                    PARTITION BY vehicle_id
                    ORDER BY observed_at, event_id
                ) AS previous_camera_id,

                LAG(observed_at) OVER (
                    PARTITION BY vehicle_id
                    ORDER BY observed_at, event_id
                ) AS previous_observed_at

            FROM events
            WHERE vehicle_id ~ '^[0-9]+$'
        )

        SELECT
            event_id,
            vehicle_id,
            camera_id,
            observed_at,
            previous_camera_id,
            previous_observed_at

        FROM ordered_events

        WHERE previous_camera_id IS NOT NULL

        ORDER BY
            vehicle_id,
            observed_at,
            event_id;
    """

    with conn.cursor() as cur:
        cur.execute(query)

        return cur.fetchall()


# ---------------------------------------------------------
# Detect unexpected camera transitions
# ---------------------------------------------------------

def detect_route_deviations(conn):

    events = get_event_sequences(conn)

    anomaly_count = 0

    for row in events:

        (
            event_id,
            vehicle_id,
            current_camera,
            observed_at,
            previous_camera,
            previous_observed_at
        ) = row

        # Ignore repeated observations at the same camera
        if previous_camera == current_camera:
            continue

        # ---------------------------------------------------------
        # Check predefined OSM camera route
        # ---------------------------------------------------------

        predefined_route_count = get_predefined_route_count(
            conn,
            previous_camera,
            current_camera
        )

        # If a valid predefined camera route exists,
        # this is NOT a route deviation.
        if predefined_route_count > 0:
            continue

        message = (
            f"Vehicle {vehicle_id} made an unexpected "
            f"camera transition: "
            f"{previous_camera} -> {current_camera}"
        )

        metadata = {
            "event_id": event_id,
            "vehicle_id": int(vehicle_id),
            "from_camera": previous_camera,
            "to_camera": current_camera,
            "observed_at": observed_at.isoformat(),
            "previous_observed_at":
                previous_observed_at.isoformat(),
            "anomaly_type": "ROUTE_DEVIATION"
        }

        insert_alert(
            conn,
            alert_type="ROUTE_DEVIATION",
            severity="HIGH",
            message=message,
            vehicle_id=int(vehicle_id),
            camera_id=current_camera,
            detected_at=observed_at,
            metadata=metadata
        )

        anomaly_count += 1

        print(
            f"[ROUTE DEVIATION] "
            f"Vehicle {vehicle_id}: "
            f"{previous_camera} -> {current_camera}"
        )

    return anomaly_count


# ---------------------------------------------------------
# Get trajectories with historical route statistics
# ---------------------------------------------------------

def get_trajectories_for_anomaly_check(conn):

    query = """
        SELECT
            t.trajectory_id,
            t.vehicle_id,
            t.from_camera_id,
            t.to_camera_id,
            t.started_at,
            t.ended_at,
            t.travel_time_seconds,

            s.average_travel_seconds,
            s.stddev_travel_seconds,
            s.sample_count

        FROM trajectories t

        LEFT JOIN route_travel_stats s
            ON s.starting_camera_id = t.from_camera_id
           AND s.ending_camera_id = t.to_camera_id

        ORDER BY
            t.started_at,
            t.trajectory_id;
    """

    with conn.cursor() as cur:
        cur.execute(query)

        return cur.fetchall()


# ---------------------------------------------------------
# Detect abnormal travel times
# ---------------------------------------------------------

def detect_abnormal_travel_times(conn):

    trajectories = get_trajectories_for_anomaly_check(conn)

    anomaly_count = 0

    for row in trajectories:

        (
            trajectory_id,
            vehicle_id,
            from_camera,
            to_camera,
            started_at,
            ended_at,
            actual_seconds,
            average_seconds,
            stddev_seconds,
            sample_count
        ) = row

        # No historical baseline
        if average_seconds is None:
            continue

        lower, upper = get_travel_time_bounds(
            average_seconds,
            stddev_seconds,
            sample_count or 0
        )

        actual_seconds = float(actual_seconds)

        if lower <= actual_seconds <= upper:
            continue

        if actual_seconds > upper:
            direction = "SLOWER"
        else:
            direction = "FASTER"

        deviation_percent = (
            (
                actual_seconds
                - float(average_seconds)
            )
            / float(average_seconds)
        ) * 100.0

        # Severity based on magnitude of deviation
        absolute_deviation = abs(deviation_percent)

        if absolute_deviation >= 50:
            severity = "HIGH"
        else:
            severity = "MEDIUM"

        message = (
            f"Vehicle {vehicle_id} had abnormal travel time "
            f"on {from_camera} -> {to_camera}: "
            f"{actual_seconds:.0f}s "
            f"(expected {lower:.0f}-{upper:.0f}s, "
            f"{direction})"
        )

        metadata = {
            "trajectory_id": trajectory_id,
            "vehicle_id": vehicle_id,
            "from_camera": from_camera,
            "to_camera": to_camera,
            "actual_travel_time_seconds":
                actual_seconds,
            "average_travel_time_seconds":
                float(average_seconds),
            "stddev_travel_time_seconds":
                (
                    float(stddev_seconds)
                    if stddev_seconds is not None
                    else None
                ),
            "sample_count":
                sample_count or 0,
            "expected_lower_seconds":
                round(lower, 2),
            "expected_upper_seconds":
                round(upper, 2),
            "deviation_percent":
                round(deviation_percent, 2),
            "anomaly_type":
                "ABNORMAL_TRAVEL_TIME"
        }

        insert_alert(
            conn,
            alert_type="ABNORMAL_TRAVEL_TIME",
            severity=severity,
            message=message,
            vehicle_id=vehicle_id,
            camera_id=to_camera,
            detected_at=ended_at,
            metadata=metadata
        )

        anomaly_count += 1

        print(
            f"[ABNORMAL TRAVEL TIME] "
            f"Vehicle {vehicle_id}: "
            f"{from_camera} -> {to_camera} "
            f"actual={actual_seconds:.0f}s "
            f"expected={lower:.0f}-{upper:.0f}s"
        )

    return anomaly_count


# ---------------------------------------------------------
# Insert alert
# ---------------------------------------------------------

def insert_alert(
    conn,
    alert_type,
    severity,
    message,
    vehicle_id,
    camera_id,
    detected_at,
    metadata
):

    # Prevent duplicate alerts when the engine
    # is executed multiple times.
    query = """
        INSERT INTO alerts (
            alert_type,
            severity,
            message,
            vehicle_id,
            camera_id,
            detected_at,
            status,
            metadata
        )
        SELECT
            %s,
            %s,
            %s,
            %s,
            %s,
            %s,
            'ACTIVE',
            %s
        WHERE NOT EXISTS (
            SELECT 1
            FROM alerts
            WHERE alert_type = %s
              AND vehicle_id = %s
              AND camera_id = %s
              AND detected_at = %s
        );
    """

    with conn.cursor() as cur:
        cur.execute(
            query,
            (
                alert_type,
                severity,
                message,
                vehicle_id,
                camera_id,
                detected_at,
                json.dumps(metadata),

                alert_type,
                vehicle_id,
                camera_id,
                detected_at,
            )
        )

    conn.commit()


# ---------------------------------------------------------
# Main
# ---------------------------------------------------------

def main():

    print("=" * 60)
    print("ROUTE ANOMALY ENGINE")
    print("=" * 60)

    conn = get_connection()

    try:

        print("\nChecking route deviations...")

        route_deviation_count = (
            detect_route_deviations(conn)
        )

        print(
            f"Route deviations detected: "
            f"{route_deviation_count}"
        )

        print("\nChecking abnormal travel times...")

        travel_time_anomaly_count = (
            detect_abnormal_travel_times(conn)
        )

        print(
            f"Travel-time anomalies detected: "
            f"{travel_time_anomaly_count}"
        )

    finally:
        conn.close()

    print("\n" + "=" * 60)
    print("ROUTE ANOMALY PROCESS COMPLETED")
    print("=" * 60)


if __name__ == "__main__":
    main()