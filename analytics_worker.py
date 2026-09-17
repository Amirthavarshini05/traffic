import time
from datetime import timedelta

from congestion_engine import process_historical_congestion

from collective_movement_engine import (
    run_collective_movement_analysis
)

from congestion_propagation_engine import (
    main as run_congestion_propagation
)


CHECK_INTERVAL_SECONDS = 900  # 15 minutes
WINDOW_MINUTES = 15


def get_latest_analysis_window():
    """
    Get the latest trajectory timestamp and create
    a 15-minute analysis window ending at that time.
    """

    from app.database import get_connection

    conn = get_connection()

    try:

        with conn.cursor() as cur:

            cur.execute(
                """
                SELECT MAX(ended_at)
                FROM trajectories;
                """
            )

            latest_time = cur.fetchone()[0]

    finally:

        conn.close()

    if latest_time is None:
        return None, None

    start_time = (
        latest_time
        - timedelta(minutes=WINDOW_MINUTES)
    )

    return start_time, latest_time


def run_analytics_cycle():

    print()
    print("=" * 70)
    print("ANALYTICS WORKER")
    print("=" * 70)

    # --------------------------------------------------
    # 1. Historical congestion
    # --------------------------------------------------

    print(
        "Running historical congestion analysis..."
    )

    try:

        process_historical_congestion()

        print(
            "Historical congestion analysis completed."
        )

    except Exception as e:

        print(
            f"Historical congestion analysis failed: {e}"
        )

    # --------------------------------------------------
    # 2. Collective movement
    # --------------------------------------------------

    print()
    print(
        "Running collective movement analysis..."
    )

    try:

        start_time, end_time = (
            get_latest_analysis_window()
        )

        if start_time is None:

            print(
                "No trajectory data found. "
                "Collective movement analysis skipped."
            )

        else:

            print(
                f"Collective movement window: "
                f"{start_time} -> {end_time}"
            )

            run_collective_movement_analysis(
                start_time,
                end_time
            )

            print(
                "Collective movement analysis completed."
            )

    except Exception as e:

        print(
            f"Collective movement analysis failed: {e}"
        )

    # --------------------------------------------------
    # 3. Congestion propagation
    # --------------------------------------------------

    print()
    print(
        "Running congestion propagation analysis..."
    )

    try:

        run_congestion_propagation()

        print(
            "Congestion propagation analysis completed."
        )

    except Exception as e:

        print(
            f"Congestion propagation analysis failed: {e}"
        )

    # --------------------------------------------------
    # 4. Publish CONGESTION_UPDATED to Redis
    # --------------------------------------------------
    try:
        from app.database import get_redis_client, get_connection
        import json
        redis_client = get_redis_client(decode_responses=True)
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT from_camera_id, to_camera_id, time_window_start, 
                       vehicle_count, average_travel_time_seconds, 
                       average_delay_seconds, travel_time_index, congestion_level
                FROM historical_congestion
                ORDER BY time_window_start DESC
                LIMIT 20;
            """)
            rows = cur.fetchall()
            congestion_data = [
                {
                    "from_camera_id": r[0],
                    "to_camera_id": r[1],
                    "time_window_start": r[2].isoformat() if r[2] else None,
                    "vehicle_count": r[3],
                    "average_travel_time_seconds": float(r[4]) if r[4] else None,
                    "average_delay_seconds": float(r[5]) if r[5] else None,
                    "travel_time_index": float(r[6]) if r[6] else None,
                    "congestion_level": r[7]
                }
                for r in rows
            ]
        conn.close()

        if congestion_data:
            redis_client.xadd(
                "congestion_events",
                {"data": json.dumps({"event_type": "CONGESTION_UPDATED", "congestion": congestion_data}, default=str)}
            )
            print("  -> Published CONGESTION_UPDATED event to Redis stream congestion_events")

    except Exception as ce:
        print(f"Failed to publish congestion to Redis: {ce}")


if __name__ == "__main__":

    print("Analytics Worker started.")

    print(
        f"Check interval: "
        f"{CHECK_INTERVAL_SECONDS} seconds"
    )

    while True:

        run_analytics_cycle()

        print()
        print(
            "Next analytics cycle in "
            f"{CHECK_INTERVAL_SECONDS} seconds..."
        )

        time.sleep(
            CHECK_INTERVAL_SECONDS
        )