import osmnx as ox
import networkx as nx
import geopandas as gpd
from shapely.geometry import LineString
import json

# --------------------------------------------------
# Load OSM road network
# --------------------------------------------------

print("Loading Chennai road network...")

G = ox.load_graphml("chennai_drive.graphml")

print(f"Nodes: {len(G.nodes)}")
print(f"Edges: {len(G.edges)}")


# --------------------------------------------------
# Camera coordinates
# --------------------------------------------------

cameras = {
    "CAM01": (80.2045, 13.0068),
    "CAM06": (80.2220, 12.9750),
}


# --------------------------------------------------
# Get nearby OSM road edges
# --------------------------------------------------

print("\nFinding nearby road edges...")

G_projected = ox.project_graph(G)

camera_edges = {}

for camera_id, (lon, lat) in cameras.items():

    # Convert camera point to projected coordinates
    point_gdf = gpd.GeoDataFrame(
        {"camera": [camera_id]},
        geometry=gpd.points_from_xy([lon], [lat]),
        crs="EPSG:4326",
    )

    point_projected = point_gdf.to_crs(G_projected.graph["crs"])

    px = point_projected.geometry.iloc[0].x
    py = point_projected.geometry.iloc[0].y

    # Get all OSM edges
    edges = ox.graph_to_gdfs(
        G_projected,
        nodes=False,
        edges=True
    )

    # Distance from camera to every edge
    edges["distance"] = edges.geometry.distance(
        point_projected.geometry.iloc[0]
    )

    # Keep the 20 closest edges
    nearest = edges.sort_values("distance").head(20)

    camera_edges[camera_id] = nearest

    print(f"\n{camera_id}:")
    print(f"Nearest edge distance: {nearest.iloc[0]['distance']:.2f} m")

    print("Nearby roads:")

    for _, row in nearest.head(5).iterrows():
        print(
            f"  {row.get('name')} | "
            f"{row.get('highway')} | "
            f"{row['distance']:.2f} m"
        )


# --------------------------------------------------
# Find a connected directional route
# --------------------------------------------------

print("\nSearching for a valid directional route...")

start_candidates = set()

for index in camera_edges["CAM01"].index:
    u, v, key = index
    start_candidates.add(u)
    start_candidates.add(v)

end_candidates = set()

for index in camera_edges["CAM06"].index:
    u, v, key = index
    end_candidates.add(u)
    end_candidates.add(v)


best_route = None
best_distance = float("inf")
best_start = None
best_end = None


for start in start_candidates:

    for end in end_candidates:

        try:
            route = nx.shortest_path(
                G,
                start,
                end,
                weight="length"
            )

            distance = nx.shortest_path_length(
                G,
                start,
                end,
                weight="length"
            )

            if distance < best_distance:
                best_route = route
                best_distance = distance
                best_start = start
                best_end = end

        except nx.NetworkXNoPath:
            continue


if best_route is None:
    raise RuntimeError(
        "No directional route found between CAM01 and CAM06."
    )


print("\nRoute found!")

print("Start OSM node:", best_start)
print("End OSM node:", best_end)
print("Number of nodes:", len(best_route))
print(f"Road distance: {best_distance:.2f} meters")


# --------------------------------------------------
# Convert route into real road geometry
# --------------------------------------------------

print("\nBuilding route geometry...")

coordinates = []


for u, v in zip(best_route[:-1], best_route[1:]):

    edge_data = G.get_edge_data(u, v)

    # Select shortest parallel edge
    key, data = min(
        edge_data.items(),
        key=lambda item: item[1].get(
            "length",
            float("inf")
        )
    )

    geometry = data.get("geometry")

    if geometry is not None:

        coords = list(geometry.coords)

        if not coordinates:
            coordinates.extend(coords)

        else:
            # Avoid duplicate connecting point
            if coordinates[-1] == coords[0]:
                coordinates.extend(coords[1:])
            else:
                coordinates.extend(coords)

    else:
        # Fallback when OSM edge has no geometry
        x1 = G.nodes[u]["x"]
        y1 = G.nodes[u]["y"]

        x2 = G.nodes[v]["x"]
        y2 = G.nodes[v]["y"]

        coords = [
            (x1, y1),
            (x2, y2)
        ]

        if not coordinates:
            coordinates.extend(coords)
        else:
            if coordinates[-1] == coords[0]:
                coordinates.extend(coords[1:])
            else:
                coordinates.extend(coords)


route_geometry = LineString(coordinates)


# --------------------------------------------------
# Save GeoJSON
# --------------------------------------------------

feature = {
    "type": "Feature",
    "properties": {
        "route_id": 7,
        "starting_node": "CAM01",
        "ending_node": "CAM06",
        "distance_m": round(best_distance, 2),
    },
    "geometry": json.loads(
        gpd.GeoSeries(
            [route_geometry],
            crs="EPSG:4326"
        ).to_json()
    )["features"][0]["geometry"],
}


geojson = {
    "type": "FeatureCollection",
    "features": [feature],
}


with open(
    "cam01_cam06_real_route.geojson",
    "w",
    encoding="utf-8"
) as file:
    json.dump(
        geojson,
        file,
        indent=2
    )


print("\nSaved:")
print("cam01_cam06_real_route.geojson")