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