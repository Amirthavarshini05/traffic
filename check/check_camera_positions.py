import osmnx as ox
import geopandas as gpd
import pandas as pd


# ============================================================
# LOAD OSM GRAPH
# ============================================================

print("Loading Chennai OSM road network...")

G = ox.load_graphml("chennai_drive.graphml")

print(f"OSM nodes : {len(G.nodes):,}")
print(f"OSM edges : {len(G.edges):,}")


# ============================================================
# YOUR EXISTING CAMERA POSITIONS
# IMPORTANT: DO NOT CHANGE THESE
# ============================================================

cameras = {
    "CAM01": (80.2045, 13.0068),
    "CAM02": (80.2505, 13.0528),
    "CAM03": (80.2462, 13.0066),
    "CAM04": (80.2481, 12.9784),
    "CAM06": (80.2220, 12.9750),
    "CAM07": (80.2495, 12.9400),
}


# ============================================================
# PROJECT GRAPH
# ============================================================

print("\nProjecting OSM graph...")

G_projected = ox.project_graph(G)

# Convert edges to GeoDataFrame
edges = ox.graph_to_gdfs(
    G_projected,
    nodes=False,
    edges=True
)


# ============================================================
# CHECK EACH CAMERA
# ============================================================

results = []

for camera_id, (lon, lat) in cameras.items():

    print("\n" + "=" * 70)
    print(f"{camera_id}")
    print("=" * 70)

    print(f"Camera coordinate:")
    print(f"  Longitude : {lon}")
    print(f"  Latitude  : {lat}")

    # Camera point
    camera_point = gpd.GeoDataFrame(
        {
            "camera_id": [camera_id]
        },
        geometry=gpd.points_from_xy(
            [lon],
            [lat]
        ),
        crs="EPSG:4326"
    )

    # Convert camera point to projected CRS
    camera_projected = camera_point.to_crs(
        G_projected.graph["crs"]
    )

    point = camera_projected.geometry.iloc[0]

    # Distance from camera to every OSM road edge
    edges_copy = edges.copy()

    edges_copy["distance_m"] = edges_copy.geometry.distance(point)

    # Get nearest 5 road segments
    nearest = edges_copy.sort_values(
        "distance_m"
    ).head(5)

    print("\nNearest OSM road segments:")

    for rank, (_, row) in enumerate(
        nearest.iterrows(),
        start=1
    ):

        road_name = row.get("name")

        if isinstance(road_name, list):
            road_name = ", ".join(
                str(x) for x in road_name
            )

        highway = row.get("highway")

        if isinstance(highway, list):
            highway = ", ".join(
                str(x) for x in highway
            )

        print(
            f"\n  #{rank}"
        )

        print(
            f"    Distance : "
            f"{row['distance_m']:.2f} m"
        )

        print(
            f"    Road     : "
            f"{road_name}"
        )

        print(
            f"    Highway  : "
            f"{highway}"
        )

        print(
            f"    Length   : "
            f"{row.get('length')} m"
        )

        print(
            f"    Oneway   : "
            f"{row.get('oneway')}"
        )

    # Best match
    best = nearest.iloc[0]

    best_name = best.get("name")

    if isinstance(best_name, list):
        best_name = ", ".join(
            str(x) for x in best_name
        )

    best_highway = best.get("highway")

    if isinstance(best_highway, list):
        best_highway = ", ".join(
            str(x) for x in best_highway
        )

    results.append(
        {
            "camera_id": camera_id,
            "longitude": lon,
            "latitude": lat,
            "nearest_road": best_name,
            "highway": best_highway,
            "distance_m": round(
                best["distance_m"],
                2
            ),
            "oneway": best.get("oneway"),
        }
    )


# ============================================================
# SUMMARY
# ============================================================

df = pd.DataFrame(results)

print("\n\n")
print("=" * 90)
print("CAMERA POSITION SUMMARY")
print("=" * 90)

print(
    df.to_string(index=False)
)


# ============================================================
# SAVE RESULT
# ============================================================

df.to_csv(
    "camera_position_check.csv",
    index=False
)

print("\nSaved:")
print("camera_position_check.csv")