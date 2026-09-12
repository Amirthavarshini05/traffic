import os
import json
import redis
import psycopg2

from event_ingestion import ingest_anpr_event
from app.database import get_connection, get_redis_client


# --------------------------------------------------
# Redis
# --------------------------------------------------

redis_client = get_redis_client(decode_responses=True, socket_timeout=None)

STREAM_NAME = "anpr_events"
GROUP_NAME = "traffic_backend"
CONSUMER_NAME = "backend_01"


# --------------------------------------------------
# PostgreSQL
# --------------------------------------------------

db_conn = get_connection()


# --------------------------------------------------
# Continuous consumer
# --------------------------------------------------

def consume_events():
    try:
        redis_client.xgroup_create(
            STREAM_NAME,
            GROUP_NAME,
            id="0",
            mkstream=True
        )
        print("Created Redis consumer group:", GROUP_NAME)
    except redis.exceptions.ResponseError as e:
        if "BUSYGROUP" in str(e):
            print("Redis consumer group already exists.")
        else:
            raise

    print(f"Listening to Redis stream: {STREAM_NAME}")
    print(f"Consumer group: {GROUP_NAME}")
    print(f"Consumer: {CONSUMER_NAME}")
    print("-" * 60)

    while True:

        messages = redis_client.xreadgroup(
            groupname=GROUP_NAME,
            consumername=CONSUMER_NAME,
            streams={
                STREAM_NAME: ">"
            },
            count=10,
            block=5000
        )

        if not messages:
            continue

        for stream_name, events in messages:

            for stream_id, event_data in events:

                print()
                print(f"Received ANPR event: {stream_id}")
                print("Redis event:", event_data)

                try:

                    # ----------------------------------
                    # Read normalized ANPR JSON
                    # ----------------------------------

                    payload = json.loads(
                        event_data["data"]
                    )

                    print("Normalized ANPR payload:")
                    print(json.dumps(
                        payload,
                        indent=2
                    ))

                    # ----------------------------------
                    # Insert into PostgreSQL
                    # ----------------------------------

                    event_id = ingest_anpr_event(
                        db_conn,
                        payload
                    )

                    print(
                        f"PostgreSQL event inserted: {event_id}"
                    )

                    # ----------------------------------
                    # ACK only after successful commit
                    # ----------------------------------

                    redis_client.xack(
                        STREAM_NAME,
                        GROUP_NAME,
                        stream_id
                    )

                    print(
                        f"Redis event acknowledged: {stream_id}"
                    )

                    print("-" * 60)

                except Exception as e:

                    db_conn.rollback()

                    print()
                    print(
                        "ERROR processing ANPR event:"
                    )
                    print(e)

                    print(
                        "Redis event was NOT acknowledged."
                    )

                    print("-" * 60)


# --------------------------------------------------
# Start
# --------------------------------------------------

if __name__ == "__main__":

    try:
        consume_events()

    finally:
        db_conn.close()