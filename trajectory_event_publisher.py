import os
import json
import time

import psycopg2
import redis
from app.database import get_connection, get_redis_client


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


# ============================================================
# Listen for new trajectories
# ============================================================

pg_cursor.execute("LISTEN trajectory_created;")

print("Trajectory event publisher started.")
print("Listening for PostgreSQL trajectory notifications...")
print("Publishing to Redis stream:", TRAJECTORY_STREAM)


# ============================================================
# Main loop
# ============================================================

while True:

    # Check PostgreSQL for notifications
    pg_conn.poll()

    while pg_conn.notifies:

        notification = pg_conn.notifies.pop(0)

        print("\nTrajectory notification received:")
        print(notification.payload)

        try:

            # Convert PostgreSQL JSON payload to Python dictionary
            trajectory_data = json.loads(
                notification.payload
            )

            # Add event type
            trajectory_data["event_type"] = "TRAJECTORY_CREATED"

            # Publish to Redis Stream
            redis_stream_id = redis_client.xadd(
                TRAJECTORY_STREAM,
                {
                    "data": json.dumps(
                        trajectory_data
                    )
                }
            )

            print("Published to Redis trajectory_events")
            print("Redis Stream ID:", redis_stream_id)
            print("Data:", trajectory_data)

        except Exception as e:

            print(
                "Failed to publish trajectory event:",
                e
            )

    # Small delay so CPU isn't unnecessarily busy
    time.sleep(0.1)