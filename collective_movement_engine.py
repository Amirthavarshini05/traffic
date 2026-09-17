import psycopg2
from datetime import datetime, timedelta, timezone
import json
from app.database import get_connection


def get_movement_counts(conn, start_time, end_time):
    query = """
        SELECT
            from_camera_id,
            to_camera_id,
            COUNT(*) AS vehicle_count
        FROM trajectories
        WHERE started_at >= %s
          AND started_at < %s
        GROUP BY
            from_camera_id,
            to_camera_id
        ORDER BY
            from_camera_id,
            vehicle_count DESC;
    """

    with conn.cursor() as cur:
        cur.execute(query, (start_time, end_time))
        rows = cur.fetchall()

    return rows


def get_historical_route_counts(
    conn,
    origin_camera_id,
    exclude_start,
    exclude_end
):
    query = """
        SELECT
            to_camera_id,
            COUNT(*) AS vehicle_count
        FROM trajectories
        WHERE from_camera_id = %s
          AND NOT (
              started_at >= %s
              AND started_at < %s
          )
        GROUP BY
            to_camera_id
        ORDER BY
            vehicle_count DESC;
    """

    with conn.cursor() as cur:
        cur.execute(
            query,
            (
                origin_camera_id,
                exclude_start,
                exclude_end
            )
        )

        rows = cur.fetchall()

    return rows


def calculate_route_shares(
    historical_rows,
    current_rows
):
    historical_total = sum(
        row[1] for row in historical_rows
    )

    current_total = sum(
        row[2] for row in current_rows
    )

    historical_shares = {}
    current_shares = {}

    if historical_total > 0:
        for destination, count in historical_rows:
            historical_shares[destination] = (
                count / historical_total
            ) * 100

    if current_total > 0:
        for origin, destination, count in current_rows:
            current_shares[destination] = (
                count / current_total
            ) * 100

    return historical_shares, current_shares


def detect_collective_anomalies(
    origin_camera_id,
    historical_rows,
    current_rows,
    historical_shares,
    current_shares
):
    anomalies = []

    for destination, current_share in current_shares.items():

        historical_share = historical_shares.get(
            destination,
            0
        )

        current_count = 0

        for origin, current_destination, count in current_rows:

            if current_destination == destination:
                current_count = count
                break

        # Minimum number of vehicles
        if current_count < MIN_VEHICLES:
            continue

        # Current route must dominate the window
        if current_share < MIN_CURRENT_SHARE:
            continue

        # Route must have been relatively uncommon historically
        if historical_share > MAX_HISTORICAL_SHARE:
            continue

        shift = (
            current_share
            - historical_share
        )

        # Determine severity
        if current_share >= 90.0 and current_count >= 10:
            severity = "CRITICAL"

        elif current_share >= 80.0 and current_count >= 5:
            severity = "HIGH"

        else:
            severity = "MEDIUM"

        anomalies.append({
            "origin_camera": origin_camera_id,
            "destination_camera": destination,
            "vehicle_count": current_count,
            "historical_share_percent": historical_share,
            "current_share_percent": current_share,
            "shift_percentage_points": shift,
            "severity": severity
        })

    return anomalies


def save_collective_alert(
    conn,
    anomaly,
    detected_at
):
    query = """
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

    metadata = {
        "origin_camera": anomaly["origin_camera"],
        "destination_camera": anomaly["destination_camera"],
        "vehicle_count": anomaly["vehicle_count"],
        "historical_share_percent": (
            anomaly["historical_share_percent"]
        ),
        "current_share_percent": (
            anomaly["current_share_percent"]
        ),
        "shift_percentage_points": (
            anomaly["shift_percentage_points"]
        ),
        "window_minutes": WINDOW_MINUTES
    }

    message = (
        f"Collective movement shift detected: "
        f"{anomaly['vehicle_count']} vehicles moved "
        f"from {anomaly['origin_camera']} toward "
        f"{anomaly['destination_camera']}. "
        f"Historical route share was "
        f"{anomaly['historical_share_percent']:.2f}%, "
        f"current share is "
        f"{anomaly['current_share_percent']:.2f}%."
    )

    with conn.cursor() as cur:

        cur.execute(
            query,
            (
                "COLLECTIVE_MOVEMENT",
                anomaly["severity"],
                message,
                anomaly["origin_camera"],
                detected_at,
                json.dumps(metadata)
            )
        )

        alert_id = cur.fetchone()[0]

    conn.commit()

    return alert_id


def get_origin_cameras(current_rows):
    return sorted(
        set(
            row[0]
            for row in current_rows
        )
    )


def run_collective_movement_analysis(
    start_time,
    end_time,
    save_alerts=True
):
    """
    Run collective movement analysis for a specific
    analysis window.

    This function is used by the future shared
    analytics worker.
    """

    conn = get_connection()

    try:

        # --------------------------------------------------
        # 1. Get current movement counts
        # --------------------------------------------------

        current_rows = get_movement_counts(
            conn,
            start_time,
            end_time
        )

        print("\nCOLLECTIVE MOVEMENT ENGINE")
        print("=" * 60)

        print(
            f"Analysis window: "
            f"{start_time} -> {end_time}"
        )

        # --------------------------------------------------
        # 2. Find all origin cameras
        # --------------------------------------------------

        origin_cameras = get_origin_cameras(
            current_rows
        )

        if not origin_cameras:

            print(
                "\nNo vehicle movements found "
                "in the current window."
            )

            return []

        # --------------------------------------------------
        # 3. Analyze every origin camera
        # --------------------------------------------------

        all_anomalies = []

        for origin_camera in origin_cameras:

            origin_current_rows = [
                row
                for row in current_rows
                if row[0] == origin_camera
            ]

            historical_rows = (
                get_historical_route_counts(
                    conn,
                    origin_camera,
                    start_time,
                    end_time
                )
            )

            historical_shares, current_shares = (
                calculate_route_shares(
                    historical_rows,
                    origin_current_rows
                )
            )

            # --------------------------------------------------
            # Display baseline
            # --------------------------------------------------

            print(
                f"\nHISTORICAL ROUTE COUNTS - "
                f"{origin_camera}"
            )

            print("=" * 60)

            for destination, count in historical_rows:

                print(
                    f"{origin_camera} -> "
                    f"{destination} : "
                    f"{count} vehicles"
                )

            # --------------------------------------------------
            # Display current movement
            # --------------------------------------------------

            print(
                f"\nCURRENT MOVEMENT - "
                f"{origin_camera}"
            )

            print("=" * 60)

            for (
                origin,
                destination,
                count
            ) in origin_current_rows:

                print(
                    f"{origin} -> "
                    f"{destination} : "
                    f"{count} vehicles"
                )

            # --------------------------------------------------
            # Display route-share comparison
            # --------------------------------------------------

            print(
                f"\nROUTE SHARE COMPARISON - "
                f"{origin_camera}"
            )

            print("=" * 60)

            destinations = (
                set(historical_shares)
                | set(current_shares)
            )

            for destination in sorted(
                destinations
            ):

                historical_share = (
                    historical_shares.get(
                        destination,
                        0
                    )
                )

                current_share = (
                    current_shares.get(
                        destination,
                        0
                    )
                )

                shift = (
                    current_share
                    - historical_share
                )

                print(
                    f"{origin_camera} -> "
                    f"{destination} | "
                    f"Historical: "
                    f"{historical_share:.2f}% | "
                    f"Current: "
                    f"{current_share:.2f}% | "
                    f"Shift: "
                    f"{shift:+.2f} percentage points"
                )

            # --------------------------------------------------
            # Detect anomalies
            # --------------------------------------------------

            anomalies = (
                detect_collective_anomalies(
                    origin_camera,
                    historical_rows,
                    origin_current_rows,
                    historical_shares,
                    current_shares
                )
            )

            all_anomalies.extend(
                anomalies
            )

        # --------------------------------------------------
        # 4. Display all detected anomalies
        # --------------------------------------------------

        print(
            "\nCOLLECTIVE MOVEMENT ANOMALIES"
        )

        print("=" * 60)

        if not all_anomalies:

            print(
                "No collective movement "
                "anomalies detected."
            )

        else:

            for anomaly in all_anomalies:

                print(
                    f"[{anomaly['severity']}] "
                    f"{anomaly['origin_camera']} -> "
                    f"{anomaly['destination_camera']} | "
                    f"Vehicles: "
                    f"{anomaly['vehicle_count']} | "
                    f"Historical: "
                    f"{anomaly['historical_share_percent']:.2f}% | "
                    f"Current: "
                    f"{anomaly['current_share_percent']:.2f}% | "
                    f"Shift: "
                    f"{anomaly['shift_percentage_points']:+.2f} pp"
                )

        # --------------------------------------------------
        # 5. Save alerts
        # --------------------------------------------------

        if save_alerts:

            for anomaly in all_anomalies:

                alert_id = save_collective_alert(
                    conn,
                    anomaly,
                    end_time
                )

                print(
                    f"Alert created: {alert_id}"
                )

        return all_anomalies

    finally:

        conn.close()


if __name__ == "__main__":

    # ------------------------------------------------------
    # Standalone test mode
    # ------------------------------------------------------
    #
    # Uses the latest trajectory timestamp as the end of
    # the analysis window, making the standalone test
    # dynamic instead of using a hard-coded historical date.
    #

    conn = get_connection()

    try:

        with conn.cursor() as cur:

            cur.execute(
                """
                SELECT MAX(ended_at)
                FROM trajectories;
                """
            )

            latest_trajectory_time = cur.fetchone()[0]

    finally:

        conn.close()

    if latest_trajectory_time is None:

        print(
            "No trajectory data found. "
            "Collective movement analysis skipped."
        )

    else:

        end_time = latest_trajectory_time

        start_time = (
            end_time
            - timedelta(minutes=WINDOW_MINUTES)
        )

        run_collective_movement_analysis(
            start_time,
            end_time
        )