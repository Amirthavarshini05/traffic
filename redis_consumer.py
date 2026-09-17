import os
import json
import redis
import psycopg2

from event_ingestion import ingest_anpr_event
from trajectory_engine import create_trajectory
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


def check_watchlist_and_alert(conn, event_dict):
    """
    Checks if the observed vehicle plate matches an active entry in vehicle_watchlist.
    If matched, generates an immediate WATCHLIST_HIT alert in the alerts table,
    which automatically triggers PostgreSQL notification and WebSocket broadcast.
    """
    plate = event_dict.get("plate")
    if not plate:
        return None

    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT watchlist_id, plate_number, priority, reason, case_reference
            FROM vehicle_watchlist
            WHERE (UPPER(plate_number) = UPPER(%s) OR UPPER(REPLACE(plate_number, '-', '')) = UPPER(REPLACE(%s, '-', '')))
              AND status = 'active'
            LIMIT 1;
        """, (plate, plate))
        row = cur.fetchone()

        if row:
            wl_id, matched_plate, priority, reason, case_ref = row
            camera_id = event_dict.get("camera_id")
            vehicle_id = event_dict.get("vehicle_id")

            alert_desc = f"[ALERT] CRITICAL WATCHLIST TARGET DETECTED: Plate {plate} sighted at {camera_id}. {reason or 'Flagged target of interest'} (Ref: {case_ref or 'POLICE-BOLO'})"
            metadata = {
                "plate_number": plate,
                "matched_watchlist_plate": matched_plate,
                "vehicle_id": vehicle_id,
                "watchlist_id": wl_id,
                "priority": priority,
                "reason": reason,
                "case_reference": case_ref,
                "camera_id": camera_id,
                "observed_at": str(event_dict.get("observed_at"))
            }

            cur.execute("""
                INSERT INTO alerts (
                    camera_id, alert_type, severity, message, vehicle_id, detected_at, status, metadata
                ) VALUES (
                    %s, 'WATCHLIST_HIT', %s, %s, %s, CURRENT_TIMESTAMP, 'ACTIVE', %s
                ) RETURNING alert_id;
            """, (
                camera_id,
                priority or 'CRITICAL',
                alert_desc,
                vehicle_id,
                json.dumps(metadata)
            ))
            alert_id = cur.fetchone()[0]
            conn.commit()
            print(f"[ALERT] LIVE WATCHLIST HIT CREATED! Alert ID #{alert_id} for plate {plate} at {camera_id}")
            return alert_id
    except Exception as err:
        conn.rollback()
        print(f"Watchlist check error: {err}")
    finally:
        cur.close()


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

                    ingested = ingest_anpr_event(
                        db_conn,
                        payload
                    )

                    event_id = ingested["event_id"]
                    print(
                        f"PostgreSQL event inserted: {event_id} (Vehicle #{ingested['vehicle_id']}, Plate {ingested['plate']})"
                    )

                    # ----------------------------------
                    # 1. Trigger Cross-Camera Trajectory Reconstruction
                    # ----------------------------------
                    try:
                        trajectory_result = create_trajectory(ingested)
                        if trajectory_result:
                            print(f"-> Trajectory created for vehicle #{ingested['vehicle_id']}")
                    except Exception as te:
                        print(f"Trajectory reconstruction notice: {te}")

                    # ----------------------------------
                    # 2. Check Watchlist for Target Interception
                    # ----------------------------------
                    try:
                        check_watchlist_and_alert(db_conn, ingested)
                    except Exception as we:
                        print(f"Watchlist check notice: {we}")

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