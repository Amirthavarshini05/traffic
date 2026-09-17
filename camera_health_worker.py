import time
from datetime import datetime, timezone

from camera_health_engine import (
    get_connection,
    get_latest_event_time,
    get_camera_last_events,
    calculate_camera_health,
    save_camera_health_alert,
)


CHECK_INTERVAL_SECONDS = 60


def run_health_check():

    conn = get_connection()

    try:
        reference_time = get_latest_event_time(conn)

        if reference_time is None:
            print("No events found. Skipping health check.")
            return

        cameras = get_camera_last_events(conn)

        print()
        print("=" * 70)
        print(f"Camera health check: {reference_time}")
        print("=" * 70)

        camera_statuses = []
        healthy_count = 0
        warning_count = 0
        offline_count = 0

        for camera in cameras:

            camera_id = camera[0]
            camera_name = camera[1]
            last_event_at = camera[3]

            health_status, minutes_since_event = (
                calculate_camera_health(
                    last_event_at,
                    reference_time
                )
            )

            if health_status == "HEALTHY":
                healthy_count += 1
            elif health_status == "WARNING":
                warning_count += 1
            else:
                offline_count += 1

            camera_statuses.append({
                "camera_id": camera_id,
                "camera_name": camera_name,
                "health_status": health_status,
                "minutes_since_last_event": round(minutes_since_event, 2) if minutes_since_event is not None else None,
                "last_event_at": last_event_at.isoformat() if last_event_at else None
            })

            print(
                f"{camera_id} | "
                f"{health_status:<8} | "
                f"{'No events' if minutes_since_event is None else f'{minutes_since_event:.1f} min ago'}"
            )

            alert_id = save_camera_health_alert(
                conn,
                camera_id,
                camera_name,
                health_status,
                minutes_since_event,
                reference_time
            )

            if alert_id:
                print(f"  -> CAMERA_HEALTH alert created: {alert_id}")

        # Publish CAMERA_HEALTH_UPDATED to Redis for WebSocket broadcast
        try:
            from app.database import get_redis_client
            import json
            redis_client = get_redis_client(decode_responses=True)
            health_payload = {
                "event_type": "CAMERA_HEALTH_UPDATED",
                "cameras": camera_statuses,
                "counts": {
                    "healthy": healthy_count,
                    "warning": warning_count,
                    "offline": offline_count,
                    "total": len(camera_statuses)
                },
                "reference_time": reference_time.isoformat() if reference_time else None
            }
            redis_client.xadd(
                "camera_health_events",
                {"data": json.dumps(health_payload, default=str)}
            )
            print("  -> Published CAMERA_HEALTH_UPDATED event to Redis stream camera_health_events")
        except Exception as re:
            print(f"Failed to publish camera health to Redis: {re}")

    except Exception as e:
        print(f"Camera health worker error: {e}")

    finally:
        conn.close()


if __name__ == "__main__":

    print("Camera Health Worker started.")
    print("Check interval: 60 seconds")

    while True:

        run_health_check()

        print("Next health check in 60 seconds...")

        time.sleep(CHECK_INTERVAL_SECONDS)