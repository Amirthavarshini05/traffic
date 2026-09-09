import json
import psycopg2
from shapely.geometry import shape


GEOJSON_PATH = r"D:\traffice_new\check\cam04_real_routes.geojson"


DB_CONFIG = {
    "host": "localhost",
    "database": "city_traffic",
    "user": "postgres",
    "password": "varsha",
    "port": 5432,
}


print("Loading generated OSM routes...")

with open(GEOJSON_PATH, "r", encoding="utf-8") as f:
    geojson = json.load(f)


conn = psycopg2.connect(**DB_CONFIG)
cur = conn.cursor()


try:

    for feature in geojson["features"]:

        properties = feature["properties"]

        route_id = properties["route_id"]
        distance_m = properties["distance_m"]

        from_camera = properties["from_camera"]
        to_camera = properties["to_camera"]

        geometry = shape(feature["geometry"])

        # Convert Shapely geometry to WKT
        geometry_wkt = geometry.wkt


        print(
            f"\nUpdating Route {route_id}: "
            f"{from_camera} -> {to_camera}"
        )

        print(
            f"Distance: {distance_m:.2f} m"
        )


        # -------------------------------------------------
        # Update geometry and distance
        # -------------------------------------------------

        cur.execute(
            """
            UPDATE camera_routes
            SET
                geometry = ST_SetSRID(
                    ST_GeomFromText(%s),
                    4326
                ),
                total_distance_m = %s
            WHERE route_id = %s;
            """,
            (
                geometry_wkt,
                distance_m,
                route_id,
            )
        )


        if cur.rowcount != 1:

            raise Exception(
                f"Route {route_id} was not updated correctly."
            )


    # -----------------------------------------------------
    # Update embedded CAM04 coordinates inside road_list
    # -----------------------------------------------------

    cur.execute(
        """
        UPDATE camera_routes
        SET road_list =
            CASE
                WHEN route_id = 8 THEN
                    jsonb_set(
                        jsonb_set(
                            road_list,
                            '{0,end_location,lat}',
                            '12.9759'::jsonb
                        ),
                        '{0,end_location,lng}',
                        '80.251'::jsonb
                    )

                WHEN route_id = 9 THEN
                    jsonb_set(
                        jsonb_set(
                            road_list,
                            '{0,end_location,lat}',
                            '12.9759'::jsonb
                        ),
                        '{0,end_location,lng}',
                        '80.251'::jsonb
                    )

                WHEN route_id = 10 THEN
                    jsonb_set(
                        jsonb_set(
                            road_list,
                            '{0,start_location,lat}',
                            '12.9759'::jsonb
                        ),
                        '{0,start_location,lng}',
                        '80.251'::jsonb
                    )

                ELSE road_list
            END
        WHERE route_id IN (8, 9, 10);
        """
    )


    conn.commit()


    print("\n======================================")
    print("✅ Routes updated successfully")
    print("======================================")


except Exception as e:

    conn.rollback()

    print("\n❌ UPDATE FAILED")
    print("Rolling back all changes...")
    print(e)

    raise


finally:

    cur.close()
    conn.close()