import os
import json
import os
import time

import psycopg2
import redis
from app.database import get_connection, get_redis_client

from dotenv import load_dotenv


# ============================================================
# Load environment variables
# ============================================================

load_dotenv()


# ============================================================
# PostgreSQL connection
# ============================================================

pg_conn = get_connection()

pg_conn.set_isolation_level(
    psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT
)

pg_cursor = pg_conn.cursor()


# ============================================================
# Redis connection
# ============================================================

redis_client = get_redis_client(decode_responses=True)

TRAJECTORY_STREAM = "trajectory_events"
ALERT_STREAM = "alert_events"


# ============================================================
# Listen for PostgreSQL notifications
# ============================================================

pg_cursor.execute("LISTEN trajectory_created;")
pg_cursor.execute("LISTEN alert_created;")

print("Realtime event publisher started.")
print("Listening for PostgreSQL notifications (trajectory_created, alert_created)...")
print(f"Publishing to Redis streams: {TRAJECTORY_STREAM}, {ALERT_STREAM}")


# ============================================================
# Main loop
# ============================================================

while True:

    # Check PostgreSQL for notifications
    pg_conn.poll()

    while pg_conn.notifies:

        notification = pg_conn.notifies.pop(0)

        channel = notification.channel
        print(f"\n[{channel}] notification received:")
        print(notification.payload)

        try:
            payload_data = json.loads(notification.payload)

            if channel == "trajectory_created":
                payload_data["event_type"] = "TRAJECTORY_CREATED"
                target_stream = TRAJECTORY_STREAM

            elif channel == "alert_created":
                payload_data["event_type"] = "ALERT_CREATED"
                target_stream = ALERT_STREAM

            else:
                target_stream = TRAJECTORY_STREAM

            # ------------------------------------------------
            # Publish to Redis Cloud Stream
            # ------------------------------------------------

            redis_stream_id = redis_client.xadd(
                target_stream,
                {
                    "data": json.dumps(payload_data, default=str)
                }
            )

            print(f"Published to Redis {target_stream} (ID: {redis_stream_id})")

        except Exception as e:
            print(f"Failed to publish event from {channel}:", e)

    # Small delay so CPU isn't unnecessarily busy
    time.sleep(0.1)