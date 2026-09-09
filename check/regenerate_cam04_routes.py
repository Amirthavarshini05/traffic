import osmnx as ox
import networkx as nx
import psycopg2
import json


GRAPH_PATH = r"D:\traffice_new\check\chennai_drive.graphml"


DB_CONFIG = {
    "host": "localhost",
    "database": "city_traffic",
    "user": "postgres",
    "password": "varsha",
    "port": 5432,
}


ROUTES = [
    (8, "CAM06", "CAM04"),
    (9, "CAM03", "CAM04"),
    (10, "CAM04", "CAM07"),
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
            'CAM03',
            'CAM04',
            'CAM06',
            'CAM07'
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

        # Choose the shortest parallel edge
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

                # Avoid duplicate joining coordinate
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


print("Loading Chennai OSM graph...")

G = ox.load_graphml(GRAPH_PATH)

print(f"Nodes: {len(G.nodes):,}")
print(f"Edges: {len(G.edges):,}")


# ---------------------------------------------------------
# Load camera coordinates from PostgreSQL
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
# Find nearest OSM node for each camera
# ---------------------------------------------------------

camera_nodes = {}


for camera_id, (lon, lat) in cameras.items():

    node = ox.distance.nearest_nodes(
        G,
        X=lon,
        Y=lat
    )

    camera_nodes[camera_id] = node

    print(
        f"\n{camera_id} -> "
        f"OSM node {node} "
        f"({G.nodes[node]['x']}, "
        f"{G.nodes[node]['y']})"
    )


# ---------------------------------------------------------
# Generate routes
# ---------------------------------------------------------

print("\n========== ROUTE GENERATION ==========")


output_routes = []


for route_id, start_camera, end_camera in ROUTES:

    start_node = camera_nodes[start_camera]
    end_node = camera_nodes[end_camera]

    print(
        f"\nRoute {route_id}: "
        f"{start_camera} -> {end_camera}"
    )

    try:

        path = nx.shortest_path(
            G,
            start_node,
            end_node,
            weight="length"
        )

    except nx.NetworkXNoPath:

        print("❌ No directed path found")

        continue


    # Calculate OSM road distance
    distance = nx.path_weight(
        G,
        path,
        weight="length"
    )


    # Build road-following geometry
    coordinates = route_geometry(
        G,
        path
    )


    # -----------------------------------------------------
    # IMPORTANT:
    # Connect route exactly to camera coordinates
    # -----------------------------------------------------

    start_lon, start_lat = cameras[start_camera]

    end_lon, end_lat = cameras[end_camera]


    # Exact starting camera coordinate
    coordinates.insert(
        0,
        (
            start_lon,
            start_lat
        )
    )


    # Exact ending camera coordinate
    coordinates.append(
        (
            end_lon,
            end_lat
        )
    )


    print(
        f"OSM nodes in path : {len(path)}"
    )

    print(
        f"Distance          : "
        f"{distance:.2f} m"
    )

    print(
        f"Coordinates        : "
        f"{len(coordinates)}"
    )

    print(
        f"Start coordinate   : "
        f"{coordinates[0]}"
    )

    print(
        f"End coordinate     : "
        f"{coordinates[-1]}"
    )


    output_routes.append({

        "type": "Feature",

        "properties": {

            "route_id": route_id,

            "from_camera": start_camera,

            "to_camera": end_camera,

            "distance_m": round(
                distance,
                2
            ),

        },

        "geometry": {

            "type": "LineString",

            "coordinates": coordinates,

        },

    })


# ---------------------------------------------------------
# Create GeoJSON
# ---------------------------------------------------------

geojson = {

    "type": "FeatureCollection",

    "features": output_routes,

}


OUTPUT_PATH = (
    r"D:\traffice_new\check"
    r"\cam04_real_routes.geojson"
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