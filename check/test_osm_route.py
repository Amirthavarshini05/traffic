import osmnx as ox
import networkx as nx

print("Loading Chennai road network...")

G = ox.load_graphml("chennai_drive.graphml")

# Existing camera coordinates: longitude, latitude
cameras = {
    "CAM01": (80.2045, 13.0068),
    "CAM06": (80.2220, 12.9750),
}

print("Finding nearest road nodes...")

camera_nodes = {}

for camera_id, (lon, lat) in cameras.items():
    node = ox.distance.nearest_nodes(G, X=lon, Y=lat)
    camera_nodes[camera_id] = node

    node_data = G.nodes[node]

    print(
        f"{camera_id} -> OSM node {node} "
        f"({node_data['x']}, {node_data['y']})"
    )

print("\nCalculating road-following route...")

start = camera_nodes["CAM01"]
end = camera_nodes["CAM06"]

try:
    route = nx.shortest_path(
        G,
        start,
        end,
        weight="length"
    )

    print("Forward route found!")
    print("Number of nodes:", len(route))

except nx.NetworkXNoPath:
    print("No forward route.")

    try:
        route = nx.shortest_path(
            G,
            end,
            start,
            weight="length"
        )

        print("Reverse route exists.")
        print("Number of nodes:", len(route))

    except nx.NetworkXNoPath:
        print("No route exists in either direction.")
        raise

print("Route found!")
print("Number of nodes:", len(route))

# Calculate total road distance
distance = 0

for u, v in zip(route[:-1], route[1:]):
    edge_data = G.get_edge_data(u, v)

    # MultiDiGraph may have multiple edges
    edge = min(
        edge_data.values(),
        key=lambda x: x.get("length", float("inf"))
    )

    distance += edge.get("length", 0)

print(f"Road distance: {distance:.2f} meters")