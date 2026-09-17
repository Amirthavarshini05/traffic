import json
import os

import networkx as nx
import numpy as np
import osmnx as ox
import psycopg2

from pyproj import Transformer
from sklearn.neighbors import NearestNeighbors


# ============================================================
# CONFIG
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
GRAPH_FILE = os.path.join(BASE_DIR, "chennai_drive.graphml")

DB_CONFIG = {
    "host": os.getenv("PGHOST", "localhost"),
    "database": os.getenv("PGDATABASE", "city_traffic"),
    "user": os.getenv("PGUSER", "postgres"),
    "password": os.getenv("PGPASSWORD", "varsha"),
    "port": int(os.getenv("PGPORT", "5432"))
}

NEARBY_NODE_COUNT = 20


# ============================================================
# LOAD CAMERAS FROM DATABASE
# ============================================================

def load_cameras(conn):

    cur = conn.cursor()

    cur.execute("""
        SELECT
            camera_id,
            ST_X(location) AS longitude,
            ST_Y(location) AS latitude
        FROM cameras
        ORDER BY camera_id;
    """)

    cameras = {}

    for camera_id, longitude, latitude in cur.fetchall():

        cameras[camera_id] = (
            float(longitude),
            float(latitude)
        )

    cur.close()

    return cameras


# ============================================================
# FIND NEARBY OSM NODES
# ============================================================

def get_nearby_nodes(
    G_projected,
    lon,
    lat,
    count=NEARBY_NODE_COUNT
):

    transformer = Transformer.from_crs(
        "EPSG:4326",
        G_projected.graph["crs"],
        always_xy=True
    )

    x, y = transformer.transform(lon, lat)

    node_ids = list(G_projected.nodes)

    coordinates = np.array([
        [
            G_projected.nodes[node]["x"],
            G_projected.nodes[node]["y"]
        ]
        for node in node_ids
    ])

    count = min(count, len(node_ids))

    nearest = NearestNeighbors(
        n_neighbors=count
    )

    nearest.fit(coordinates)

    distances, indices = nearest.kneighbors(
        [[x, y]]
    )

    return [
        node_ids[index]
        for index in indices[0]
    ]


# ============================================================
# FIND SHORTEST VALID DIRECTED ROUTE
# ============================================================

def find_best_route(
    G,
    start_candidates,
    end_candidates
):

    best_path = None
    best_distance = float("inf")

    for start_node in start_candidates:

        for end_node in end_candidates:

            if start_node == end_node:
                continue

            try:

                path = nx.shortest_path(
                    G,
                    start_node,
                    end_node,
                    weight="length"
                )

                distance = nx.path_weight(
                    G,
                    path,
                    weight="length"
                )

                if distance < best_distance:

                    best_path = path
                    best_distance = distance

            except nx.NetworkXNoPath:

                continue

    return best_path, best_distance


# ============================================================
# BUILD REAL OSM GEOMETRY
# ============================================================

def build_route_geometry(
    G,
    path,
    start_coordinate,
    end_coordinate
):

    coordinates = []

    for u, v in zip(path[:-1], path[1:]):

        edge_data = G.get_edge_data(u, v)

        if not edge_data:
            continue

        # MultiDiGraph can contain multiple parallel edges.
        # Select the shortest available edge.
        edge = min(
            edge_data.values(),
            key=lambda data: data.get(
                "length",
                float("inf")
            )
        )

        geometry = edge.get("geometry")

        if geometry is not None:

            edge_coordinates = [
                (lon, lat)
                for lon, lat in geometry.coords
            ]

        else:

            edge_coordinates = [
                (
                    float(G.nodes[u]["x"]),
                    float(G.nodes[u]["y"])
                ),
                (
                    float(G.nodes[v]["x"]),
                    float(G.nodes[v]["y"])
                )
            ]

        if not coordinates:

            coordinates.extend(edge_coordinates)

        else:

            # Avoid duplicating the joining point.
            coordinates.extend(
                edge_coordinates[1:]
            )

    # Exact camera coordinates.
    start_lon, start_lat = start_coordinate
    end_lon, end_lat = end_coordinate

    coordinates.insert(
        0,
        (start_lon, start_lat)
    )

    coordinates.append(
        (end_lon, end_lat)
    )

    return coordinates


# ============================================================
# CHECK EXISTING ROUTE
# ============================================================

def get_existing_route_id(
    cur,
    start_camera,
    end_camera
):

    cur.execute("""
        SELECT route_id
        FROM camera_routes
        WHERE starting_node = %s
          AND ending_node = %s
        ORDER BY route_id
        LIMIT 1;
    """, (
        start_camera,
        end_camera
    ))

    row = cur.fetchone()

    if row:
        return row[0]

    return None


# ============================================================
# INSERT / UPDATE CAMERA ROUTE
# ============================================================

def save_route(
    cur,
    route_id,
    start_camera,
    end_camera,
    distance_m,
    coordinates
):

    geometry = {
        "type": "LineString",
        "coordinates": coordinates
    }

    road_list = [
        start_camera,
        end_camera
    ]

    if route_id is None:

        cur.execute("""
            INSERT INTO camera_routes
            (
                starting_node,
                ending_node,
                road_list,
                total_distance_m,
                geometry
            )
            VALUES
            (
                %s,
                %s,
                %s,
                %s,
                ST_SetSRID(
                    ST_GeomFromGeoJSON(%s),
                    4326
                )
            )
            RETURNING route_id;
        """, (
            start_camera,
            end_camera,
            json.dumps(road_list),
            distance_m,
            json.dumps(geometry)
        ))

        new_id = cur.fetchone()[0]

        return new_id, "INSERT"

    else:

        cur.execute("""
            UPDATE camera_routes
            SET
                road_list = %s,
                total_distance_m = %s,
                geometry = ST_SetSRID(
                    ST_GeomFromGeoJSON(%s),
                    4326
                )
            WHERE route_id = %s;
        """, (
            json.dumps(road_list),
            distance_m,
            json.dumps(geometry),
            route_id
        ))

        return route_id, "UPDATE"


# ============================================================
# MAIN
# ============================================================

def main():

    print("=" * 70)
    print("CAMERA ROUTE GENERATOR")
    print("=" * 70)

    # --------------------------------------------------------
    # Load OSM graph
    # --------------------------------------------------------

    print("\nLoading Chennai OSM graph...")

    G = ox.load_graphml(GRAPH_FILE)

    print(
        f"Graph loaded: "
        f"{len(G.nodes):,} nodes, "
        f"{len(G.edges):,} edges"
    )

    # --------------------------------------------------------
    # Project graph for accurate nearby-node search
    # --------------------------------------------------------

    print("\nProjecting graph...")

    G_projected = ox.project_graph(G)

    print(
        f"Projected CRS: "
        f"{G_projected.graph['crs']}"
    )

    # --------------------------------------------------------
    # Database
    # --------------------------------------------------------

    print("\nConnecting to PostgreSQL...")

    conn = psycopg2.connect(
        **DB_CONFIG
    )

    cur = conn.cursor()

    # --------------------------------------------------------
    # Cameras
    # --------------------------------------------------------

    cameras = load_cameras(conn)

    print(
        f"\nLoaded {len(cameras)} cameras:"
    )

    for camera_id, coordinate in cameras.items():

        print(
            f"  {camera_id}: "
            f"{coordinate[0]}, "
            f"{coordinate[1]}"
        )

    # --------------------------------------------------------
    # Nearby OSM candidates
    # --------------------------------------------------------

    print("\nFinding nearby OSM nodes...")

    camera_candidates = {}

    for camera_id, (lon, lat) in cameras.items():

        candidates = get_nearby_nodes(
            G_projected,
            lon,
            lat
        )

        camera_candidates[camera_id] = candidates

        print(
            f"  {camera_id}: "
            f"{len(candidates)} candidates"
        )

    # --------------------------------------------------------
    # Generate every directed camera pair
    # --------------------------------------------------------

    camera_ids = list(cameras.keys())

    total_pairs = (
        len(camera_ids)
        * (len(camera_ids) - 1)
    )

    print("\n" + "=" * 70)
    print(
        f"GENERATING {total_pairs} DIRECTED ROUTES"
    )
    print("=" * 70)

    inserted = 0
    updated = 0
    failed = 0

    for start_camera in camera_ids:

        for end_camera in camera_ids:

            if start_camera == end_camera:
                continue

            print(
                f"\n{start_camera} -> {end_camera}"
            )

            path, distance = find_best_route(
                G,
                camera_candidates[start_camera],
                camera_candidates[end_camera]
            )

            if path is None:

                print(
                    "  NO VALID DIRECTED ROUTE"
                )

                failed += 1

                continue

            coordinates = build_route_geometry(
                G,
                path,
                cameras[start_camera],
                cameras[end_camera]
            )

            existing_route_id = get_existing_route_id(
                cur,
                start_camera,
                end_camera
            )

            route_id, action = save_route(
                cur,
                existing_route_id,
                start_camera,
                end_camera,
                distance,
                coordinates
            )

            conn.commit()

            if action == "INSERT":

                inserted += 1

            else:

                updated += 1

            print(
                f"  Route ID: {route_id}"
            )

            print(
                f"  Distance: "
                f"{distance / 1000:.2f} km"
            )

            print(
                f"  OSM nodes: "
                f"{len(path)}"
            )

            print(
                f"  Geometry points: "
                f"{len(coordinates)}"
            )

            print(
                f"  Action: {action}"
            )

    # --------------------------------------------------------
    # Summary
    # --------------------------------------------------------

    cur.close()
    conn.close()

    print("\n" + "=" * 70)
    print("ROUTE GENERATION COMPLETE")
    print("=" * 70)

    print(
        f"Inserted: {inserted}"
    )

    print(
        f"Updated:  {updated}"
    )

    print(
        f"Failed:   {failed}"
    )

    print(
        f"Total:    {total_pairs}"
    )


if __name__ == "__main__":
    main()