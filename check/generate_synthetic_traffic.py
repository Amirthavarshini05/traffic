import random
from datetime import datetime, timedelta

import psycopg2


# --------------------------------------------------
# DATABASE CONFIGURATION
# --------------------------------------------------

DB_CONFIG = {
    "host": "localhost",
    "database": "city_traffic",
    "user": "postgres",
    "password": "varsha",
    "port": 5432,
}


# --------------------------------------------------
# TEST CONFIGURATION
# --------------------------------------------------

NUMBER_OF_VEHICLES = 20

START_TIME = datetime(2026, 9, 9, 8, 0, 0)

PLATE_PREFIX = "TEST-SYNTH"

VEHICLE_TYPES = ["CAR", "SUV", "TRUCK", "BIKE"]
COLORS = ["WHITE", "BLACK", "RED", "BLUE", "GREY"]


# --------------------------------------------------
# DATABASE CONNECTION
# --------------------------------------------------

def get_connection():
    return psycopg2.connect(**DB_CONFIG)


# --------------------------------------------------
# LOAD CAMERA ROUTES
# --------------------------------------------------

def load_routes(conn):
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            route_id,
            starting_node,
            ending_node,
            total_distance_m
        FROM camera_routes
        WHERE starting_node <> ending_node
        ORDER BY route_id;
    """)

    routes = cursor.fetchall()

    cursor.close()

    return routes


# --------------------------------------------------
# LOAD HISTORICAL TRAVEL STATISTICS
# --------------------------------------------------

def load_route_stats(conn):
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            starting_camera_id,
            ending_camera_id,
            average_travel_seconds,
            stddev_travel_seconds,
            sample_count
        FROM route_travel_stats;
    """)

    rows = cursor.fetchall()

    cursor.close()

    return {
        (row[0], row[1]): {
            "average": float(row[2]),
            "stddev": float(row[3]) if row[3] is not None else None,
            "sample_count": int(row[4]),
        }
        for row in rows
    }


# --------------------------------------------------
# LOAD CAMERA LOCATIONS
# --------------------------------------------------

def load_camera_locations(conn):
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            camera_id,
            ST_X(location) AS longitude,
            ST_Y(location) AS latitude
        FROM cameras;
    """)

    rows = cursor.fetchall()

    cursor.close()

    return {
        row[0]: {
            "longitude": float(row[1]),
            "latitude": float(row[2])
        }
        for row in rows
    }


# --------------------------------------------------
# CREATE VEHICLE
# --------------------------------------------------

def create_vehicle(conn, plate_number):
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO vehicles (plate_number)
        VALUES (%s)
        RETURNING vehicle_id;
    """, (plate_number,))

    vehicle_id = cursor.fetchone()[0]

    cursor.close()

    return vehicle_id


# --------------------------------------------------
# CREATE EVENT
# --------------------------------------------------

def create_event(
    conn,
    vehicle_id,
    camera_id,
    plate_number,
    observed_at,
    camera_location,
):
    cursor = conn.cursor()

    vehicle_type = random.choice(VEHICLE_TYPES)
    color = random.choice(COLORS)

    cursor.execute("""
        INSERT INTO events (
            vehicle_id,
            camera_id,
            plate_number,
            vehicle_type,
            make,
            model,
            color,
            observed_at,
            received_at,
            confidence,
            heading,
            location,
            raw_data
        )
        VALUES (
            %s,
            %s,
            %s,
            %s,
            %s,
            %s,
            %s,
            %s,
            %s,
            %s,
            %s,
            ST_SetSRID(
                ST_MakePoint(%s, %s),
                4326
            ),
            %s
        )
        RETURNING event_id;
    """, (
        str(vehicle_id),
        camera_id,
        plate_number,
        vehicle_type,
        "TEST",
        "TEST",
        color,
        observed_at,
        observed_at + timedelta(seconds=1),
        round(random.uniform(0.94, 0.99), 2),
        random.randint(0, 359),
        camera_location["longitude"],
        camera_location["latitude"],
        '{"source": "synthetic_traffic_generator"}'
    ))

    event_id = cursor.fetchone()[0]

    cursor.close()

    return event_id


# --------------------------------------------------
# CALCULATE TRAVEL TIME
# --------------------------------------------------

def calculate_travel_time(
    starting_camera,
    ending_camera,
    distance_m,
    route_stats
):
    key = (starting_camera, ending_camera)

    # ----------------------------------------------
    # CASE 1: HISTORICAL DATA EXISTS
    # ----------------------------------------------

    if key in route_stats:

        stats = route_stats[key]

        average = stats["average"]

        # Controlled variation around historical average.
        # ±10% stays safely inside the trigger's
        # historical validation range of ±20%.
        variation = random.uniform(0.90, 1.10)

        travel_seconds = average * variation

        return int(max(60, travel_seconds)), "HISTORICAL"


    # ----------------------------------------------
    # CASE 2: NO HISTORICAL DATA
    # ----------------------------------------------

    # Use realistic synthetic speed.
    speed_kmh = random.uniform(30, 60)

    travel_seconds = (
        distance_m / 1000
    ) / speed_kmh * 3600

    travel_seconds = int(max(60, travel_seconds))

    return travel_seconds, "DISTANCE"


# --------------------------------------------------
# GENERATE UNIQUE PLATE
# --------------------------------------------------

def generate_plate(index):
    timestamp_part = datetime.now().strftime("%H%M%S")

    return f"{PLATE_PREFIX}-{timestamp_part}-{index:03d}"


# --------------------------------------------------
# MAIN
# --------------------------------------------------

def main():

    print("=" * 70)
    print("SYNTHETIC TRAFFIC GENERATOR")
    print("=" * 70)

    conn = get_connection()

    try:

        # ------------------------------------------
        # LOAD DATA
        # ------------------------------------------

        routes = load_routes(conn)

        route_stats = load_route_stats(conn)

        camera_locations = load_camera_locations(conn)

        print(f"Loaded routes: {len(routes)}")
        print(f"Loaded historical route stats: {len(route_stats)}")
        print(f"Loaded cameras: {len(camera_locations)}")

        if not routes:
            raise RuntimeError("No camera routes found.")

        if not camera_locations:
            raise RuntimeError("No cameras found.")


        # ------------------------------------------
        # SELECT ROUTES
        # ------------------------------------------

        selected_routes = random.sample(
            routes,
            min(NUMBER_OF_VEHICLES, len(routes))
        )

        print()
        print(
            f"Generating {len(selected_routes)} "
            f"vehicle journeys..."
        )
        print()


        # ------------------------------------------
        # SYNTHETIC TIME
        # ------------------------------------------

        current_time = START_TIME


        # ------------------------------------------
        # GENERATE JOURNEYS
        # ------------------------------------------

        for index, route in enumerate(
            selected_routes,
            start=1
        ):

            route_id = route[0]
            starting_camera = route[1]
            ending_camera = route[2]
            distance_m = float(route[3])


            # --------------------------------------
            # UNIQUE VEHICLE
            # --------------------------------------

            plate_number = generate_plate(index)

            vehicle_id = create_vehicle(
                conn,
                plate_number
            )


            # --------------------------------------
            # TRAVEL TIME
            # --------------------------------------

            travel_seconds, timing_method = (
                calculate_travel_time(
                    starting_camera,
                    ending_camera,
                    distance_m,
                    route_stats
                )
            )


            # --------------------------------------
            # START EVENT
            # --------------------------------------

            start_event_id = create_event(
                conn,
                vehicle_id,
                starting_camera,
                plate_number,
                current_time,
                camera_locations[starting_camera]
            )


            # --------------------------------------
            # END EVENT
            # --------------------------------------

            end_time = (
                current_time
                + timedelta(seconds=travel_seconds)
            )

            end_event_id = create_event(
                conn,
                vehicle_id,
                ending_camera,
                plate_number,
                end_time,
                camera_locations[ending_camera]
            )


            # --------------------------------------
            # COMMIT
            # --------------------------------------

            conn.commit()


            # --------------------------------------
            # OUTPUT
            # --------------------------------------

            print(
                f"[{index:02d}] "
                f"Vehicle {vehicle_id} | "
                f"{starting_camera} -> {ending_camera} | "
                f"Route {route_id} | "
                f"{distance_m:.2f} m | "
                f"{travel_seconds} sec | "
                f"{timing_method} | "
                f"Events {start_event_id}, {end_event_id}"
            )


            # --------------------------------------
            # MOVE SYNTHETIC CLOCK
            # --------------------------------------

            current_time = (
                end_time
                + timedelta(minutes=2)
            )


        print()
        print("=" * 70)
        print("SYNTHETIC GENERATION COMPLETE")
        print("=" * 70)


    except Exception:

        conn.rollback()
        raise


    finally:

        conn.close()


# --------------------------------------------------
# ENTRY POINT
# --------------------------------------------------

if __name__ == "__main__":
    main()