import json
import os
import time

import psycopg2
import redis

from dotenv import load_dotenv


# ============================================================
# Load environment variables
# ============================================================

load_dotenv()


# ============================================================
# PostgreSQL connection
# ============================================================

pg_conn = psycopg2.connect(
    host=os.getenv("DB_HOST"),
    database=os.getenv("DB_NAME", "postgres"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    port=int(os.getenv("DB_PORT", "5432")),
    sslmode=os.getenv("DB_SSLMODE", "require")
)

pg_conn.set_isolation_level(
    psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT
)

pg_cursor = pg_conn.cursor()


# ============================================================
# Redis connection
# ============================================================

redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST"),
    port=int(os.getenv("REDIS_PORT", "6379")),
    username=os.getenv("REDIS_USERNAME", "default"),
    password=os.getenv("REDIS_PASSWORD"),
    ssl=os.getenv("REDIS_SSL", "false").lower() == "true",
    decode_responses=True
)

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

            # ------------------------------------------------
            # Publish to Redis Cloud Stream
            # ------------------------------------------------

            redis_stream_id = redis_client.xadd(
                TRAJECTORY_STREAM,
                {
                    "data": json.dumps(
                        trajectory_data
                    )
                }
            )

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

        except Exception as e:

            print(
                "Failed to publish trajectory event:",
                e
            )

    # Small delay so CPU isn't unnecessarily busy
    time.sleep(0.1)