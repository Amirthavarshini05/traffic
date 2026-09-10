import redis
import psycopg2


# --------------------------------------------------
# Redis
# --------------------------------------------------

redis_client = redis.Redis(
    host="localhost",
    port=6379,
    decode_responses=True,
    socket_timeout=None
)

STREAM_NAME = "anpr_events"
GROUP_NAME = "e2e_test"
CONSUMER_NAME = "e2e_db_01"


# --------------------------------------------------
# PostgreSQL
# --------------------------------------------------

db_conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="city_traffic",
    user="postgres",
    password="varsha"
)

db_cursor = db_conn.cursor()


# --------------------------------------------------
# Read ONE new event from Redis
# --------------------------------------------------

messages = redis_client.xreadgroup(
    groupname=GROUP_NAME,
    consumername=CONSUMER_NAME,
    streams={
        STREAM_NAME: ">"
    },
    count=1,
    block=5000
)


if not messages:

    print("No new Redis event available.")

else:

    for stream_name, events in messages:

        for stream_id, event in events:

            try:

                print("Received Redis event:")
                print(event)

                # ------------------------------------------
                # 1. Find vehicle using plate number
                # ------------------------------------------

                db_cursor.execute(
                    """
                    SELECT vehicle_id
                    FROM vehicles
                    WHERE plate_number = %s
                    LIMIT 1;
                    """,
                    (event["plate_number"],)
                )

                vehicle_row = db_cursor.fetchone()


                # ------------------------------------------
                # 2. Create vehicle if it doesn't exist
                # ------------------------------------------

                if vehicle_row:

                    vehicle_id = vehicle_row[0]

                    print()
                    print("Existing vehicle found.")
                    print("PostgreSQL vehicle_id:", vehicle_id)

                else:

                    db_cursor.execute(
                        """
                        INSERT INTO vehicles (
                            plate_number
                        )
                        VALUES (%s)
                        RETURNING vehicle_id;
                        """,
                        (event["plate_number"],)
                    )

                    vehicle_id = db_cursor.fetchone()[0]

                    print()
                    print("New vehicle created.")
                    print("PostgreSQL vehicle_id:", vehicle_id)


                # ------------------------------------------
                # 3. Insert ANPR event
                # ------------------------------------------

                insert_sql = """
                    INSERT INTO events (
                        vehicle_id,
                        camera_id,
                        plate_number,
                        confidence,
                        observed_at
                    )
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING event_id;
                """

                db_cursor.execute(
                    insert_sql,
                    (
                        str(vehicle_id),
                        event["camera_id"],
                        event["plate_number"],
                        float(event["confidence"]),
                        event["observed_at"]
                    )
                )

                event_id = db_cursor.fetchone()[0]


                # ------------------------------------------
                # 4. Commit PostgreSQL transaction
                # ------------------------------------------

                db_conn.commit()


                # ------------------------------------------
                # 5. Acknowledge Redis event
                # ------------------------------------------

                redis_client.xack(
                    STREAM_NAME,
                    GROUP_NAME,
                    stream_id
                )


                # ------------------------------------------
                # 6. Success information
                # ------------------------------------------

                print()
                print("PostgreSQL event inserted!")
                print("PostgreSQL event_id:", event_id)
                print("PostgreSQL vehicle_id:", vehicle_id)
                print("Redis stream_id:", stream_id)
                print("Redis event acknowledged.")


            except Exception as e:

                # ------------------------------------------
                # Roll back PostgreSQL transaction
                # ------------------------------------------

                db_conn.rollback()

                print()
                print("ERROR processing Redis event:")
                print(e)

                print()
                print("Redis event was NOT acknowledged.")


# --------------------------------------------------
# Close connections
# --------------------------------------------------

db_cursor.close()
db_conn.close()