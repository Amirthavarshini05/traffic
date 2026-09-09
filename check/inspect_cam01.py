import osmnx as ox

G = ox.load_graphml("chennai_drive.graphml")

lon = 80.2045
lat = 13.0068

nearby = ox.distance.nearest_nodes(
    G,
    X=lon,
    Y=lat,
    return_dist=True
)

print("Nearest node:", nearby[0])
print("Distance:", nearby[1], "meters")

print("\nNearby road nodes:")

nodes = ox.distance.nearest_nodes(
    G,
    X=lon,
    Y=lat,
    return_dist=False
)

# Get several nearest nodes using projected graph
G_projected = ox.project_graph(G)

nearest_projected = ox.distance.nearest_nodes(
    G_projected,
    X=ox.projection.project_geometry(
        ox.utils_geo.Point(lon, lat),
        to_crs=G_projected.graph["crs"]
    )[0].x,
    Y=ox.projection.project_geometry(
        ox.utils_geo.Point(lon, lat),
        to_crs=G_projected.graph["crs"]
    )[0].y
)

print("Projected nearest node:", nearest_projected)