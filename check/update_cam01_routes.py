import os
import json
import psycopg2
from psycopg2.extras import Json

DB_CONFIG = {
    "host": os.getenv("PGHOST", "localhost"),
    "database": os.getenv("PGDATABASE", "city_traffic"),
    "user": os.getenv("PGUSER", "postgres"),
    "password": os.getenv("PGPASSWORD", "varsha"),
    "port": int(os.getenv("PGPORT", "5432"))
}

GEOJSON_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cam01_real_routes.geojson")

conn = psycopg2.connect(**DB_CONFIG)
cur = conn.cursor()

with open(GEOJSON_FILE, "r", encoding="utf-8") as f:
    data = json.load(f)

for feature in data["features"]:
    props = feature["properties"]

    route_id = props["route_id"]
    distance_m = props["distance_m"]
    coordinates = feature["geometry"]["coordinates"]

    print(f"Updating route {route_id}...")
    print(f"  Distance: {distance_m:.2f} m")
    print(f"  Coordinates: {len(coordinates)} points")

    cur.execute("""
        UPDATE camera_routes
        SET
            geometry = ST_SetSRID(
                ST_GeomFromGeoJSON(%s),
                4326
            ),
            total_distance_m = %s
        WHERE route_id = %s;
    """, (
        json.dumps(feature["geometry"]),
        distance_m,
        route_id
    ))

conn.commit()

print("\nRoutes 6 and 7 updated successfully.")

cur.close()
conn.close()