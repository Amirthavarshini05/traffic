import psycopg2
import json


# =========================================================
# Database Configuration
# =========================================================

DB_CONFIG = {
    "host": "localhost",
    "database": "city_traffic",
    "user": "postgres",
    "password": "varsha",
    "port": 5432
}


# =========================================================
# Health Configuration
# =========================================================

HEALTHY_LIMIT_MINUTES = 5
WARNING_LIMIT_MINUTES = 15


# =========================================================
# Database Connection
# =========================================================

def get_connection():
    return psycopg2.connect(**DB_CONFIG)


# =========================================================
# Get Last Event for Every Camera
# =========================================================

def get_camera_last_events(conn):

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

    with conn.cursor() as cur:
        cur.execute(query)
        return cur.fetchall()


# =========================================================
# Get Latest Event Time in Entire System
# =========================================================

def get_latest_event_time(conn):

    query = """
        SELECT MAX(observed_at)
        FROM events
        WHERE observed_at IS NOT NULL;
    """

    with conn.cursor() as cur:
        cur.execute(query)
        row = cur.fetchone()

    if not row:
        return None

    return row[0]


# =========================================================
# Calculate Camera Health
# =========================================================

def calculate_camera_health(
    last_event_at,
    reference_time
):

    if last_event_at is None:
        return "OFFLINE", None

    time_since_event = (
        reference_time - last_event_at
    )

    seconds_since_event = (
        time_since_event.total_seconds()
    )

    minutes_since_event = (
        seconds_since_event / 60
    )

    # -----------------------------------------------------
    # Protect against future timestamps
    # -----------------------------------------------------

    if minutes_since_event < 0:
        minutes_since_event = 0.0

    # -----------------------------------------------------
    # Determine health status
    # -----------------------------------------------------

    if minutes_since_event <= HEALTHY_LIMIT_MINUTES:

        health_status = "HEALTHY"

    elif minutes_since_event <= WARNING_LIMIT_MINUTES:

        health_status = "WARNING"

    else:

        health_status = "OFFLINE"

    return health_status, minutes_since_event


# =========================================================
# Save Camera Health Alert
# =========================================================

def save_camera_health_alert(
    conn,
    camera_id,
    camera_name,
    health_status,
    minutes_since_event,
    detected_at
):

    # Healthy cameras don't require alerts.

    if health_status == "HEALTHY":
        return None

    # -----------------------------------------------------
    # Check for existing active alert
    # -----------------------------------------------------

    check_query = """
        SELECT alert_id

        FROM alerts

        WHERE alert_type = 'CAMERA_HEALTH'
          AND camera_id = %s
          AND status = 'ACTIVE'

        LIMIT 1;
    """

    with conn.cursor() as cur:

        cur.execute(
            check_query,
            (camera_id,)
        )

        existing_alert = cur.fetchone()

    if existing_alert:
        return None

    # -----------------------------------------------------
    # Create new alert
    # -----------------------------------------------------

    insert_query = """
        INSERT INTO alerts (
            alert_type,
            severity,
            message,
            vehicle_id,
            road_id,
            camera_id,
            zone_id,
            detected_at,
            status,
            metadata
        )

        VALUES (
            %s,
            %s,
            %s,
            NULL,
            NULL,
            %s,
            NULL,
            %s,
            'ACTIVE',
            %s
        )

        RETURNING alert_id;
    """

    # OFFLINE = HIGH
    # WARNING = MEDIUM

    severity = (
        "HIGH"
        if health_status == "OFFLINE"
        else "MEDIUM"
    )

    message = (
        f"Camera {camera_id} ({camera_name}) "
        f"is {health_status}. "
        f"Last event was "
        f"{minutes_since_event:.1f} minutes ago."
    )

    metadata = {
        "camera_id": camera_id,
        "camera_name": camera_name,
        "health_status": health_status,
        "minutes_since_last_event": round(
            minutes_since_event,
            2
        )
    }

    with conn.cursor() as cur:

        cur.execute(
            insert_query,
            (
                "CAMERA_HEALTH",
                severity,
                message,
                camera_id,
                detected_at,
                json.dumps(metadata)
            )
        )

        alert_id = cur.fetchone()[0]

    conn.commit()

    return alert_id


# =========================================================
# Main
# =========================================================

if __name__ == "__main__":

    conn = get_connection()

    try:

        # -------------------------------------------------
        # Determine reference time dynamically
        # -------------------------------------------------

        reference_time = get_latest_event_time(conn)

        if reference_time is None:

            print(
                "\nNo events found in the database."
            )

            raise SystemExit(0)

        # -------------------------------------------------
        # Get camera information
        # -------------------------------------------------

        cameras = get_camera_last_events(conn)

        print("\nCAMERA / NETWORK HEALTH")
        print("=" * 70)

        print(
            f"Reference time: {reference_time}"
        )

        print("=" * 70)

        # -------------------------------------------------
        # Analyze every camera
        # -------------------------------------------------

        for camera in cameras:

            camera_id = camera[0]
            camera_name = camera[1]
            configured_status = camera[2]
            last_event_at = camera[3]

            health_status, minutes_since_event = (
                calculate_camera_health(
                    last_event_at,
                    reference_time
                )
            )

            # -------------------------------------------------
            # Format display
            # -------------------------------------------------

            if minutes_since_event is None:

                time_text = "No events"

            else:

                time_text = (
                    f"{minutes_since_event:.1f} minutes ago"
                )

            print(
                f"{camera_id} | "
                f"{health_status:<8} | "
                f"{time_text:<20} | "
                f"Configured: {configured_status}"
            )

            # -------------------------------------------------
            # Save alert if necessary
            # -------------------------------------------------

            alert_id = save_camera_health_alert(
                conn,
                camera_id,
                camera_name,
                health_status,
                minutes_since_event,
                reference_time
            )

            if alert_id:

                print(
                    f"  -> Alert created: "
                    f"{alert_id}"
                )

    finally:

        conn.close()