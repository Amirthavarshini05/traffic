import osmnx as ox

GRAPH_PATH = r"D:\traffice_new\check\chennai_drive.graphml"

CAM04_LAT = 12.975900
CAM04_LON = 80.251000

print("Loading Chennai OSM graph...")
G = ox.load_graphml(GRAPH_PATH)

print(f"Nodes: {len(G.nodes):,}")
print(f"Edges: {len(G.edges):,}")

# Use the original geographic graph.
# Camera coordinates are longitude/latitude.
node = ox.distance.nearest_nodes(
    G,
    X=CAM04_LON,
    Y=CAM04_LAT
)

node_data = G.nodes[node]

print("\n========== CAM04 OSM CHECK ==========")
print(f"Camera coordinate : {CAM04_LAT}, {CAM04_LON}")

print("\nNearest OSM node:")
print(f"Node ID           : {node}")
print(f"Node longitude    : {node_data.get('x')}")
print(f"Node latitude     : {node_data.get('y')}")

print("\nOutgoing roads from nearest node:")
for _, target, key, d in G.out_edges(node, keys=True, data=True):
    print(
        f"  -> {target} | "
        f"name={d.get('name')} | "
        f"highway={d.get('highway')} | "
        f"length={d.get('length')}m"
    )

print("\nIncoming roads to nearest node:")
for source, _, key, d in G.in_edges(node, keys=True, data=True):
    print(
        f"  <- {source} | "
        f"name={d.get('name')} | "
        f"highway={d.get('highway')} | "
        f"length={d.get('length')}m"
    )

print("\n======================================")