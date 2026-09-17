import os
import osmnx as ox
import networkx as nx
import psycopg2
import json

from sklearn.neighbors import NearestNeighbors
from pyproj import Transformer


GRAPH_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chennai_drive.graphml")

DB_CONFIG = {
    "host": os.getenv("PGHOST", "localhost"),
    "database": os.getenv("PGDATABASE", "city_traffic"),
    "user": os.getenv("PGUSER", "postgres"),
    "password": os.getenv("PGPASSWORD", "varsha"),
    "port": int(os.getenv("PGPORT", "5432")),
}

ROUTES = [
    (6, "CAM01", "CAM02"),
    (7, "CAM01", "CAM06"),
]


def get_camera_coordinates():

    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    cur.execute("""
        SELECT
            camera_id,
            ST_X(location) AS longitude,
            ST_Y(location) AS latitude
        FROM cameras
        WHERE camera_id IN (
            'CAM01',
            'CAM02',
            'CAM06'
        )
    """)

    rows = cur.fetchall()

    cur.close()
    conn.close()

    return {
        camera_id: (longitude, latitude)
        for camera_id, longitude, latitude in rows
    }


def edge_geometry(edge_data):

    geometry = edge_data.get("geometry")

    if geometry is not None:
        return list(geometry.coords)

    return None


def route_geometry(G, path):

    coordinates = []

    for u, v in zip(path[:-1], path[1:]):

        edge_data = G.get_edge_data(u, v)

        if not edge_data:
            continue

        key = min(
            edge_data,
            key=lambda k: edge_data[k].get(
                "length",
                float("inf")
            )
        )

        data = edge_data[key]

        coords = edge_geometry(data)

        if coords:

            if coordinates:

                if coordinates[-1] == coords[0]:
                    coordinates.extend(coords[1:])
                else:
                    coordinates.extend(coords)

            else:
                coordinates.extend(coords)

        else:

            coordinates.append(
                (
                    G.nodes[u]["x"],
                    G.nodes[u]["y"]
                )
            )

            coordinates.append(
                (
                    G.nodes[v]["x"],
                    G.nodes[v]["y"]
                )
            )

    return coordinates


def get_nearby_nodes(G_projected, lon, lat, count=20):

    transformer = Transformer.from_crs(
        "EPSG:4326",
        G_projected.graph["crs"],
        always_xy=True
    )

    x, y = transformer.transform(lon, lat)

    node_ids = list(G_projected.nodes)

    points = [
        (
            G_projected.nodes[n]["x"],
            G_projected.nodes[n]["y"]
        )
        for n in node_ids
    ]

    model = NearestNeighbors(
        n_neighbors=min(count, len(points)),
        algorithm="kd_tree"
    )

    model.fit(points)

    _, indices = model.kneighbors(
        [[x, y]]
    )

    return [
        node_ids[i]
        for i in indices[0]
    ]


print("Loading Chennai OSM graph...")

G = ox.load_graphml(GRAPH_PATH)

print(f"Nodes: {len(G.nodes):,}")
print(f"Edges: {len(G.edges):,}")


# ---------------------------------------------------------
# Load camera coordinates
# ---------------------------------------------------------

cameras = get_camera_coordinates()

print("\nCamera coordinates from PostgreSQL:")

for camera_id, coords in cameras.items():

    print(
        f"{camera_id}: "
        f"lon={coords[0]}, "
        f"lat={coords[1]}"
    )


# ---------------------------------------------------------
# Project graph for accurate nearby-node search
# ---------------------------------------------------------

G_projected = ox.project_graph(G)


# ---------------------------------------------------------
# Find candidate OSM nodes
# ---------------------------------------------------------

candidate_nodes = {}

for camera_id, (lon, lat) in cameras.items():

    nodes = get_nearby_nodes(
        G_projected,
        lon,
        lat,
        count=20
    )

    candidate_nodes[camera_id] = nodes

    print(
        f"\n{camera_id}: "
        f"{len(nodes)} nearby OSM candidates"
    )

    for node in nodes[:5]:

        print(
            f"  {node}: "
            f"({G.nodes[node]['x']}, "
            f"{G.nodes[node]['y']})"
        )


# ---------------------------------------------------------
# Find best directed path between camera candidates
# ---------------------------------------------------------

print("\n========== ROUTE GENERATION ==========")

output_routes = []


for route_id, start_camera, end_camera in ROUTES:

    print(
        f"\nRoute {route_id}: "
        f"{start_camera} -> {end_camera}"
    )

    start_candidates = candidate_nodes[start_camera]
    end_candidates = candidate_nodes[end_camera]

    best_path = None
    best_distance = float("inf")
    best_start_node = None
    best_end_node = None

    for start_node in start_candidates:

        for end_node in end_candidates:

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

                    best_distance = distance
                    best_path = path
                    best_start_node = start_node
                    best_end_node = end_node

            except nx.NetworkXNoPath:

                continue


    if best_path is None:

        print("❌ No directed path found")

        continue


    print(
        f"Selected start OSM node: "
        f"{best_start_node}"
    )

    print(
        f"Selected end OSM node: "
        f"{best_end_node}"
    )

    print(
        f"OSM nodes in path: "
        f"{len(best_path)}"
    )

    print(
        f"Distance: "
        f"{best_distance:.2f} m"
    )


    # Build OSM road geometry
    coordinates = route_geometry(
        G,
        best_path
    )


    # -----------------------------------------------------
    # Exact camera endpoints
    # -----------------------------------------------------

    start_lon, start_lat = cameras[start_camera]

    end_lon, end_lat = cameras[end_camera]


    coordinates.insert(
        0,
        (
            start_lon,
            start_lat
        )
    )


    coordinates.append(
        (
            end_lon,
            end_lat
        )
    )


    print(
        f"Start coordinate: "
        f"{coordinates[0]}"
    )

    print(
        f"End coordinate: "
        f"{coordinates[-1]}"
    )

    print(
        f"Coordinates: "
        f"{len(coordinates)}"
    )


    output_routes.append({

        "type": "Feature",

        "properties": {

            "route_id": route_id,

            "from_camera": start_camera,

            "to_camera": end_camera,

            "distance_m": round(
                best_distance,
                2
            ),

        },

        "geometry": {

            "type": "LineString",

            "coordinates": coordinates,

        },

    })


# ---------------------------------------------------------
# Save GeoJSON
# ---------------------------------------------------------

geojson = {

    "type": "FeatureCollection",

    "features": output_routes,

}


OUTPUT_PATH = (
    r"D:\traffice_new\check"
    r"\cam01_real_routes.geojson"
)


with open(
    OUTPUT_PATH,
    "w",
    encoding="utf-8"
) as f:

    json.dump(
        geojson,
        f,
        indent=2
    )


print("\n======================================")

print(
    f"Generated routes: "
    f"{len(output_routes)}"
)

print(
    f"Saved to: "
    f"{OUTPUT_PATH}"
)

print("======================================")