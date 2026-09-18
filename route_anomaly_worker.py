import os
import json
import os
import redis
from dotenv import load_dotenv
from app.database import get_connection, get_redis_client


# =========================================================
# Load environment variables
# =========================================================

load_dotenv()


# =========================================================
# Redis Configuration
# =========================================================

TRAJECTORY_STREAM = "trajectory_events"
CONSUMER_GROUP = "route_anomaly"
CONSUMER_NAME = "route_anomaly_01"


# =========================================================
# Redis Connection
# =========================================================

redis_client = get_redis_client(decode_responses=True, socket_timeout=None)


# =========================================================
# Create Consumer Group
# =========================================================

try:

    redis_client.xgroup_create(
        TRAJECTORY_STREAM,
        CONSUMER_GROUP,
        id="0",
        mkstream=True
    )

    print(
        "Created Redis consumer group:",
        CONSUMER_GROUP
    )

except redis.exceptions.ResponseError as e:

    if "BUSYGROUP" in str(e):

        print(
            "Redis consumer group already exists."
        )

    else:
        raise


# =========================================================
# Get trajectory
# =========================================================

def get_trajectory(conn, trajectory_id):

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

        WHERE t.trajectory_id = %s;
    """

    with conn.cursor() as cur:

        cur.execute(
            query,
            (trajectory_id,)
        )

        return cur.fetchone()


# =========================================================
# Calculate abnormal travel-time bounds
# =========================================================

def get_travel_time_bounds(
    average_seconds,
    stddev_seconds,
    sample_count
):

    average_seconds = float(average_seconds)

    # Less than 5 samples
    # Use average +/- 20%

    if sample_count < 5:

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
        - 2.0 * stddev_seconds
    )

    statistical_upper = (
        average_seconds
        + 2.0 * stddev_seconds
    )

    # Use wider range

    lower = min(
        percentage_lower,
        statistical_lower
    )

    upper = max(
        percentage_upper,
        statistical_upper
    )

    return max(lower, 0.0), upper


# =========================================================
# Insert alert
# =========================================================

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
                detected_at
            )
        )

    conn.commit()


# =========================================================
# Process trajectory
# =========================================================

def process_trajectory(trajectory_id):

    conn = get_connection()

    try:

        trajectory = get_trajectory(
            conn,
            trajectory_id
        )

        if trajectory is None:

            print(
                f"Trajectory {trajectory_id} "
                "not found."
            )

            return

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
        ) = trajectory

        print(
            f"\nChecking trajectory {trajectory_id}: "
            f"Vehicle {vehicle_id}, "
            f"{from_camera} -> {to_camera}"
        )

        # No historical baseline

        if average_seconds is None:

            print(
                "No historical baseline. "
                "Skipping travel-time anomaly check."
            )

            return

        lower, upper = get_travel_time_bounds(
            average_seconds,
            stddev_seconds,
            sample_count or 0
        )

        actual_seconds = float(
            actual_seconds
        )

        # Normal trajectory

        if lower <= actual_seconds <= upper:

            print(
                f"Normal travel time: "
                f"{actual_seconds:.0f}s "
                f"(expected "
                f"{lower:.0f}-{upper:.0f}s)"
            )

            return

        # Determine direction

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

        absolute_deviation = abs(
            deviation_percent
        )

        if absolute_deviation >= 50:
            severity = "HIGH"
        else:
            severity = "MEDIUM"

        message = (
            f"Vehicle {vehicle_id} had abnormal "
            f"travel time on "
            f"{from_camera} -> {to_camera}: "
            f"{actual_seconds:.0f}s "
            f"(expected "
            f"{lower:.0f}-{upper:.0f}s, "
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

        print(
            f"[ABNORMAL TRAVEL TIME] "
            f"Vehicle {vehicle_id}: "
            f"{from_camera} -> {to_camera} "
            f"actual={actual_seconds:.0f}s "
            f"expected={lower:.0f}-{upper:.0f}s"
        )

    finally:

        conn.close()


# =========================================================
# Main Worker
# =========================================================

def main():

    print("=" * 60)
    print("REAL-TIME ROUTE ANOMALY WORKER")
    print("=" * 60)

    print(
        "Listening to Redis stream:",
        TRAJECTORY_STREAM
    )

    print(
        "Consumer group:",
        CONSUMER_GROUP
    )

    print(
        "Consumer:",
        CONSUMER_NAME
    )

    while True:

        messages = redis_client.xreadgroup(
            groupname=CONSUMER_GROUP,
            consumername=CONSUMER_NAME,
            streams={
                TRAJECTORY_STREAM: ">"
            },
            count=1,
            block=5000
        )

        if not messages:
            continue

        for stream_name, entries in messages:

            for redis_message_id, fields in entries:

                try:

                    data = json.loads(
                        fields["data"]
                    )

                    trajectory_id = int(
                        data["trajectory_id"]
                    )

                    print(
                        "\nRedis event received:"
                    )

                    print(data)

                    process_trajectory(
                        trajectory_id
                    )

                    # ACK only after
                    # successful processing

                    redis_client.xack(
                        TRAJECTORY_STREAM,
                        CONSUMER_GROUP,
                        redis_message_id
                    )

                    print(
                        "ACK:",
                        redis_message_id
                    )

                except Exception as e:

                    print(
                        "Error processing "
                        "Redis message:",
                        e
                    )


# =========================================================
# Start
# =========================================================

if __name__ == "__main__":
    main()