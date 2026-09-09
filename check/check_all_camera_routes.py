import osmnx as ox
import networkx as nx
from sklearn.neighbors import NearestNeighbors
from pyproj import Transformer
import numpy as np


GRAPH_FILE = r"D:\traffice_new\check\chennai_drive.graphml"

CAMERAS = {
    "CAM01": (80.2045, 13.0068),
    "CAM02": (80.2505, 13.0528),
    "CAM03": (80.2462, 13.0066),
    "CAM04": (80.2510, 12.9759),
    "CAM05": (80.1980, 13.0694),
    "CAM06": (80.2220, 12.9750),
    "CAM07": (80.2495, 12.9400),
    "CAM08": (80.1700, 12.9800),
    "CAM09": (80.2750, 13.0820),
    "CAM10": (80.2300, 13.0400),
}


def get_nearby_nodes(G_projected, lon, lat, count=20):
    """
    Find several nearby OSM nodes instead of relying on only
    the single nearest node.

    This handles cases where the nearest node is a one-way
    dead-end from the camera's direction.
    """

    transformer = Transformer.from_crs(
        "EPSG:4326",
        G_projected.graph["crs"],
        always_xy=True
    )

    x, y = transformer.transform(lon, lat)

    node_ids = list(G_projected.nodes)

    coords = np.array([
        [G_projected.nodes[n]["x"], G_projected.nodes[n]["y"]]
        for n in node_ids
    ])

    count = min(count, len(node_ids))

    nn = NearestNeighbors(
        n_neighbors=count
    )

    nn.fit(coords)

    distances, indices = nn.kneighbors(
        [[x, y]]
    )

    return [
        node_ids[i]
        for i in indices[0]
    ]


def find_best_directed_route(G, start_candidates, end_candidates):
    """
    Try every nearby start/end candidate combination and
    keep the shortest valid directed path.
    """

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
                    best_distance = distance
                    best_path = path

            except nx.NetworkXNoPath:
                continue

    return best_path, best_distance


print("Loading Chennai OSM graph...")

G = ox.load_graphml(GRAPH_FILE)

print(f"Graph loaded.")
print(f"Nodes: {len(G.nodes):,}")
print(f"Edges: {len(G.edges):,}")

print("\nProjecting graph...")

G_projected = ox.project_graph(G)

print(f"Projected CRS: {G_projected.graph['crs']}")

print("\nFinding camera candidates...")

camera_candidates = {}

for camera_id, (lon, lat) in CAMERAS.items():

    candidates = get_nearby_nodes(
        G_projected,
        lon,
        lat,
        count=20
    )

    camera_candidates[camera_id] = candidates

    print(
        f"{camera_id}: "
        f"{len(candidates)} nearby nodes"
    )


print("\n" + "=" * 70)
print("DIRECTED CAMERA-TO-CAMERA ROUTE CHECK")
print("=" * 70)

camera_ids = list(CAMERAS.keys())

for start_camera in camera_ids:

    for end_camera in camera_ids:

        if start_camera == end_camera:
            continue

        path, distance = find_best_directed_route(
            G,
            camera_candidates[start_camera],
            camera_candidates[end_camera]
        )

        if path is None:

            print(
                f"{start_camera} -> {end_camera}   NO ROUTE"
            )

        else:

            print(
                f"{start_camera} -> {end_camera}   "
                f"{distance / 1000:.2f} km   "
                f"{len(path)} nodes"
            )

print("\nRoute connectivity check complete.")