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

<<<<<<< HEAD
pg_conn = psycopg2.connect(
    host=os.getenv("DB_HOST"),
    database=os.getenv("DB_NAME", "postgres"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    port=int(os.getenv("DB_PORT", "5432")),
    sslmode=os.getenv("DB_SSLMODE", "require")
)
=======
pg_conn = get_connection()
>>>>>>> a9331665902c117f4454d08a61250aaf29124ea5

pg_conn.set_isolation_level(
    psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT
)

pg_cursor = pg_conn.cursor()


# ============================================================
# Redis connection
# ============================================================

<<<<<<< HEAD
redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST"),
    port=int(os.getenv("REDIS_PORT", "6379")),
    username=os.getenv("REDIS_USERNAME", "default"),
    password=os.getenv("REDIS_PASSWORD"),
    ssl=os.getenv("REDIS_SSL", "false").lower() == "true",
    decode_responses=True
)
=======
redis_client = get_redis_client(decode_responses=True)
>>>>>>> a9331665902c117f4454d08a61250aaf29124ea5

TRAJECTORY_STREAM = "trajectory_events"
ALERT_STREAM = "alert_events"


# ============================================================
# Listen for PostgreSQL notifications
# ============================================================

pg_cursor.execute("LISTEN trajectory_created;")
pg_cursor.execute("LISTEN alert_created;")

<<<<<<< HEAD

print("Trajectory event publisher started.")
print("Listening for PostgreSQL trajectory notifications...")
print("Publishing to Redis stream:", TRAJECTORY_STREAM)
=======
print("Realtime event publisher started.")
print("Listening for PostgreSQL notifications (trajectory_created, alert_created)...")
print(f"Publishing to Redis streams: {TRAJECTORY_STREAM}, {ALERT_STREAM}")
>>>>>>> a9331665902c117f4454d08a61250aaf29124ea5


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

<<<<<<< HEAD
            # ------------------------------------------------
            # Convert PostgreSQL JSON payload to dictionary
            # ------------------------------------------------

            trajectory_data = json.loads(
                notification.payload
            )

            # ------------------------------------------------
            # Add event type
            # ------------------------------------------------

            trajectory_data["event_type"] = "TRAJECTORY_CREATED"
=======
            if channel == "trajectory_created":
                payload_data["event_type"] = "TRAJECTORY_CREATED"
                target_stream = TRAJECTORY_STREAM

            elif channel == "alert_created":
                payload_data["event_type"] = "ALERT_CREATED"
                target_stream = ALERT_STREAM

            else:
                target_stream = TRAJECTORY_STREAM
>>>>>>> a9331665902c117f4454d08a61250aaf29124ea5

            # ------------------------------------------------
            # Publish to Redis Cloud Stream
            # ------------------------------------------------

            redis_stream_id = redis_client.xadd(
                target_stream,
                {
                    "data": json.dumps(payload_data, default=str)
                }
            )

<<<<<<< HEAD
            print(
                "Published to Redis trajectory_events"
            )

            print(
                "Redis Stream ID:",
                redis_stream_id
            )

            print(
                "Data:",
                trajectory_data
            )
=======
            print(f"Published to Redis {target_stream} (ID: {redis_stream_id})")
>>>>>>> a9331665902c117f4454d08a61250aaf29124ea5

        except Exception as e:
            print(f"Failed to publish event from {channel}:", e)

    # Small delay so CPU isn't unnecessarily busy
    time.sleep(0.1)