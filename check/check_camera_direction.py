import osmnx as ox
import networkx as nx

G = ox.load_graphml("chennai_drive.graphml")

cameras = {
    "CAM01": (80.2045, 13.0068),
    "CAM06": (80.2220, 12.9750),
}

nodes = {}

for camera_id, (lon, lat) in cameras.items():
    nodes[camera_id] = ox.distance.nearest_nodes(G, X=lon, Y=lat)

start = nodes["CAM01"]
end = nodes["CAM06"]

print(f"CAM01 OSM node: {start}")
print(f"CAM06 OSM node: {end}")

print("\nChecking connectivity...")

print(
    "CAM01 -> CAM06:",
    nx.has_path(G, start, end)
)

print(
    "CAM06 -> CAM01:",
    nx.has_path(G, end, start)
)

print("\nCAM01 outgoing edges:")

for _, target, data in G.out_edges(start, data=True):
    print(
        f"  -> {target} | "
        f"road={data.get('name')} | "
        f"highway={data.get('highway')} | "
        f"oneway={data.get('oneway')}"
    )

print("\nCAM01 incoming edges:")

for source, _, data in G.in_edges(start, data=True):
    print(
        f"  {source} -> CAM01 | "
        f"road={data.get('name')} | "
        f"highway={data.get('highway')} | "
        f"oneway={data.get('oneway')}"
    )