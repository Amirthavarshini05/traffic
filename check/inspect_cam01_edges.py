import osmnx as ox
import math

G = ox.load_graphml("chennai_drive.graphml")

camera_lon = 80.2045
camera_lat = 13.0068

nearest = ox.distance.nearest_edges(
    G,
    X=camera_lon,
    Y=camera_lat,
    return_dist=True
)

print("Nearest edge:")
print("Edge:", nearest[0])
print("Distance:", nearest[1], "meters")

u, v, key = nearest[0]

data = G.edges[u, v, key]

print("\nEdge details:")
print("From node:", u)
print("To node:", v)
print("Road:", data.get("name"))
print("Highway:", data.get("highway"))
print("One-way:", data.get("oneway"))
print("Length:", data.get("length"))
print("Geometry:", data.get("geometry"))