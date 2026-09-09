import osmnx as ox
import networkx as nx
import geopandas as gpd
from shapely.geometry import LineString
import json

# --------------------------------------------------
# Load OSM network
# --------------------------------------------------

print("Loading Chennai road network...")

G = ox.load_graphml("chennai_drive.graphml")

print(f"Nodes: {len(G.nodes)}")
print(f"Edges: {len(G.edges)}")


# --------------------------------------------------
# Cameras
# --------------------------------------------------

cameras = {
    "CAM01": (80.2045, 13.0068),
    "CAM02": (80.2505, 13.0528),
    "CAM03": (80.2462, 13.0066),
    "CAM04": (80.2481, 12.9784),
    "CAM06": (80.2220, 12.9750),
    "CAM07": (80.2495, 12.9400),
}


# Existing predefined camera routes
routes = [
    ("CAM01", "CAM02"),
    ("CAM01", "CAM06"),
    ("CAM06", "CAM04"),
    ("CAM03", "CAM04"),
    ("CAM04", "CAM07"),
]


# --------------------------------------------------
# Get nearby candidate nodes
# --------------------------------------------------

def get_candidate_nodes(lon, lat, count=20):

    projected = ox.project_graph(G)

    point = gpd.GeoDataFrame(
        geometry=gpd.points_from_xy([lon], [lat]),
        crs="EPSG:4326",
    ).to_crs(projected.graph["crs"])

    edges = ox.graph_to_gdfs(
        projected,
        nodes=False,
        edges=True
    )

    edges["distance"] = edges.geometry.distance(
        point.geometry.iloc[0]
    )

    nearest_edges = edges.sort_values("distance").head(count)

    candidates = set()

    for u, v, key in nearest_edges.index:
        candidates.add(u)
        candidates.add(v)

    return list(candidates)


# --------------------------------------------------
# Build geometry from OSM route
# --------------------------------------------------

def build_geometry(route):

    coordinates = []

    for u, v in zip(route[:-1], route[1:]):

        edge_data = G.get_edge_data(u, v)

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
        else:
            coords = [
                (G.nodes[u]["x"], G.nodes[u]["y"]),
                (G.nodes[v]["x"], G.nodes[v]["y"])
            ]

        if not coordinates:
            coordinates.extend(coords)
        elif coordinates[-1] == coords[0]:
            coordinates.extend(coords[1:])
        else:
            coordinates.extend(coords)

    return LineString(coordinates)


# --------------------------------------------------
# Generate routes
# --------------------------------------------------

features = []

for route_number, (start_camera, end_camera) in enumerate(routes, start=1):

    print("\n" + "=" * 60)
    print(f"ROUTE {route_number}: {start_camera} -> {end_camera}")
    print("=" * 60)

    start_lon, start_lat = cameras[start_camera]
    end_lon, end_lat = cameras[end_camera]

    print("Finding nearby OSM candidates...")

    start_candidates = get_candidate_nodes(
        start_lon,
        start_lat
    )

    end_candidates = get_candidate_nodes(
        end_lon,
        end_lat
    )

    print(
        f"Start candidates: {len(start_candidates)}"
    )

    print(
        f"End candidates: {len(end_candidates)}"
    )

    best_route = None
    best_distance = float("inf")
    best_start = None
    best_end = None

    for start in start_candidates:

        for end in end_candidates:

            try:

                distance = nx.shortest_path_length(
                    G,
                    start,
                    end,
                    weight="length"
                )

                if distance < best_distance:

                    route = nx.shortest_path(
                        G,
                        start,
                        end,
                        weight="length"
                    )

                    best_route = route
                    best_distance = distance
                    best_start = start
                    best_end = end

            except nx.NetworkXNoPath:
                continue

    if best_route is None:

        print("❌ NO DIRECTED ROUTE FOUND")

        continue

    print("✅ Route found")

    print("Start OSM node:", best_start)
    print("End OSM node:", best_end)
    print("OSM nodes:", len(best_route))
    print(f"Distance: {best_distance:.2f} m")

    geometry = build_geometry(best_route)

    feature = {
        "type": "Feature",
        "properties": {
            "route_id": route_number,
            "starting_node": start_camera,
            "ending_node": end_camera,
            "distance_m": round(best_distance, 2),
            "osm_start_node": str(best_start),
            "osm_end_node": str(best_end),
        },
        "geometry": json.loads(
            gpd.GeoSeries(
                [geometry],
                crs="EPSG:4326"
            ).to_json()
        )["features"][0]["geometry"],
    }

    features.append(feature)


# --------------------------------------------------
# Save GeoJSON
# --------------------------------------------------

output = {
    "type": "FeatureCollection",
    "features": features,
}


with open(
    "all_camera_routes_osm.geojson",
    "w",
    encoding="utf-8"
) as file:

    json.dump(
        output,
        file,
        indent=2
    )


print("\n" + "=" * 60)
print("DONE")
print("=" * 60)

print(
    f"Successfully generated {len(features)} "
    f"of {len(routes)} routes."
)

print("Output:")
print("all_camera_routes_osm.geojson")