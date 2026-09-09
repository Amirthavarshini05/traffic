import osmnx as ox

print("Downloading Chennai road network...")

G = ox.graph.graph_from_place(
    "Chennai, Tamil Nadu, India",
    network_type="drive"
)

print("Download successful!")
print("Nodes:", len(G.nodes))
print("Edges:", len(G.edges))

print("Saving road network...")

ox.io.save_graphml(G, "chennai_drive.graphml")

print("Saved as chennai_drive.graphml")