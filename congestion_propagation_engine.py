from app.database import get_connection


# ---------------------------------------------------------
# Configuration
# ---------------------------------------------------------

SOURCE_CONGESTION_WEIGHT = 40.0
FLOW_PROBABILITY_WEIGHT = 30.0
CONTINUATION_WEIGHT = 15.0
DOWNSTREAM_CONGESTION_WEIGHT = 15.0

# Evidence factors
EVIDENCE_LOW = 0.50
EVIDENCE_MEDIUM = 0.75
EVIDENCE_HIGH = 0.90
EVIDENCE_VERY_HIGH = 1.00


# ---------------------------------------------------------
# Evidence strength
# ---------------------------------------------------------

def get_evidence_level(sample_count):
    if sample_count < 5:
        return "LOW", EVIDENCE_LOW

    if sample_count < 20:
        return "MEDIUM", EVIDENCE_MEDIUM

    if sample_count < 50:
        return "HIGH", EVIDENCE_HIGH

    return "VERY HIGH", EVIDENCE_VERY_HIGH


# ---------------------------------------------------------
# Calculate propagation score
# ---------------------------------------------------------

def calculate_propagation_score(
    source_delay_percent,
    downstream_probability_percent,
    continuation_rate_percent,
    downstream_delay_percent,
    continuation_samples
):
    # Source congestion contribution
    source_score = min(
        (float(source_delay_percent) / 50.0)
        * SOURCE_CONGESTION_WEIGHT,
        SOURCE_CONGESTION_WEIGHT
    )

    # Downstream flow contribution
    flow_score = (
        float(downstream_probability_percent) / 100.0
    ) * FLOW_PROBABILITY_WEIGHT

    # Continuation contribution
    continuation_score = (
        float(continuation_rate_percent) / 100.0
    ) * CONTINUATION_WEIGHT

    # Existing downstream congestion contribution
    downstream_score = min(
        (float(downstream_delay_percent) / 50.0)
        * DOWNSTREAM_CONGESTION_WEIGHT,
        DOWNSTREAM_CONGESTION_WEIGHT
    )

    # Raw score
    raw_score = (
        source_score
        + flow_score
        + continuation_score
        + downstream_score
    )

    # Evidence adjustment
    evidence_level, evidence_factor = get_evidence_level(
        continuation_samples
    )

    final_score = raw_score * evidence_factor

    # Propagation classification
    if final_score <= 25:
        propagation_level = "LOW"

    elif final_score <= 50:
        propagation_level = "MEDIUM"

    elif final_score <= 75:
        propagation_level = "HIGH"

    else:
        propagation_level = "SEVERE"

    return {
        "source_score": round(source_score, 2),
        "flow_score": round(flow_score, 2),
        "continuation_score": round(continuation_score, 2),
        "downstream_score": round(downstream_score, 2),
        "raw_score": round(raw_score, 2),
        "evidence_factor": evidence_factor,
        "evidence_level": evidence_level,
        "final_score": round(final_score, 2),
        "propagation_level": propagation_level,
    }


# ---------------------------------------------------------
# Find downstream routes
# ---------------------------------------------------------

def find_downstream_routes(
    conn,
    source_from_camera,
    source_to_camera
):
    query = """
        WITH source_routes AS (
            SELECT
                trajectory_id,
                vehicle_id
            FROM trajectories
            WHERE from_camera_id = %s
              AND to_camera_id = %s
        )

        SELECT
            d.from_camera_id,
            d.to_camera_id,
            COUNT(DISTINCT d.vehicle_id)
                AS downstream_vehicles
        FROM source_routes s

        JOIN trajectories d
            ON d.vehicle_id = s.vehicle_id
           AND d.prev_trajectory_id = s.trajectory_id

        GROUP BY
            d.from_camera_id,
            d.to_camera_id

        ORDER BY
            downstream_vehicles DESC;
    """

    with conn.cursor() as cur:
        cur.execute(
            query,
            (
                source_from_camera,
                source_to_camera,
            )
        )

        return cur.fetchall()


# ---------------------------------------------------------
# Calculate route flow statistics
# ---------------------------------------------------------

def get_flow_statistics(
    conn,
    source_from_camera,
    source_to_camera,
    downstream_from_camera,
    downstream_to_camera
):
    query = """
        WITH source_routes AS (
            SELECT
                trajectory_id,
                vehicle_id
            FROM trajectories
            WHERE from_camera_id = %s
              AND to_camera_id = %s
        ),

        downstream_routes AS (
            SELECT
                s.vehicle_id,
                d.from_camera_id,
                d.to_camera_id
            FROM source_routes s

            JOIN trajectories d
                ON d.vehicle_id = s.vehicle_id
               AND d.prev_trajectory_id = s.trajectory_id
        ),

        source_count AS (
            SELECT
                COUNT(DISTINCT vehicle_id)
                    AS total_source_vehicles
            FROM source_routes
        ),

        continuation_count AS (
            SELECT
                COUNT(DISTINCT vehicle_id)
                    AS vehicles_with_continuation
            FROM downstream_routes
        ),

        selected_downstream_count AS (
            SELECT
                COUNT(DISTINCT vehicle_id)
                    AS downstream_vehicles
            FROM downstream_routes
            WHERE from_camera_id = %s
              AND to_camera_id = %s
        )

        SELECT
            sc.total_source_vehicles,
            cc.vehicles_with_continuation,
            dc.downstream_vehicles

        FROM source_count sc
        CROSS JOIN continuation_count cc
        CROSS JOIN selected_downstream_count dc;
    """

    with conn.cursor() as cur:
        cur.execute(
            query,
            (
                source_from_camera,
                source_to_camera,
                downstream_from_camera,
                downstream_to_camera,
            )
        )

        row = cur.fetchone()

    if not row:
        return None

    total_source = row[0] or 0
    continuation = row[1] or 0
    downstream = row[2] or 0

    if total_source > 0:
        continuation_rate = (
            continuation / total_source
        ) * 100.0
    else:
        continuation_rate = 0.0

    if continuation > 0:
        downstream_probability = (
            downstream / continuation
        ) * 100.0
    else:
        downstream_probability = 0.0

    return {
        "total_source_vehicles": total_source,
        "vehicles_with_continuation": continuation,
        "downstream_vehicles": downstream,
        "continuation_rate_percent": continuation_rate,
        "downstream_probability_percent": downstream_probability,
    }


# ---------------------------------------------------------
# Get latest congestion for a route
# ---------------------------------------------------------

def get_latest_congestion(
    conn,
    from_camera,
    to_camera,
    time_window_start=None
):
    query = """
    SELECT
        congestion_level,
        average_delay_percent,
        average_travel_time_seconds,
        vehicle_count,
        time_window_start,
        time_window_end
    FROM historical_congestion

    WHERE from_camera_id = %s
      AND to_camera_id = %s
      AND (
            %s IS NULL
            OR time_window_start = %s
          )

    ORDER BY time_window_start DESC

    LIMIT 1;
"""

    with conn.cursor() as cur:
        cur.execute(
            query,
            (
                from_camera,
                to_camera,
                time_window_start,
                time_window_start,
            )
        )

        row = cur.fetchone()

    if not row:
        return {
            "congestion_level": "UNKNOWN",
            "average_delay_percent": 0.0,
            "average_travel_time_seconds": 0.0,
            "vehicle_count": 0,
            "time_window_start": None,
            "time_window_end": None,
        }

    return {
        "congestion_level": row[0],
        "average_delay_percent": float(row[1] or 0),
        "average_travel_time_seconds": float(row[2] or 0),
         "vehicle_count": row[3] or 0,
    "time_window_start": row[4],
    "time_window_end": row[5],
    }


# ---------------------------------------------------------
# Store propagation prediction
# ---------------------------------------------------------

def store_propagation(
    conn,
    source_from,
    source_to,
    downstream_from,
    downstream_to,
    flow_probability,
    source_congestion,
    propagation_score,
    propagation_level,
    estimated_impact_minutes,
    metadata
):
    query = """
        INSERT INTO congestion_propagation (
            source_from_camera_id,
            source_to_camera_id,
            downstream_from_camera_id,
            downstream_to_camera_id,
            flow_probability_percent,
            source_congestion_level,
            propagation_score,
            propagation_level,
            estimated_impact_minutes,
            detected_at,
            status,
            metadata
        )

        VALUES (
            %s, %s, %s, %s,
            %s, %s, %s, %s, %s,
            CURRENT_TIMESTAMP,
            'ACTIVE',
            %s
        );
    """

    import json

    with conn.cursor() as cur:
        cur.execute(
            query,
            (
                source_from,
                source_to,
                downstream_from,
                downstream_to,
                flow_probability,
                source_congestion,
                propagation_score,
                propagation_level,
                estimated_impact_minutes,
                json.dumps(metadata),
            )
        )

    conn.commit()


# ---------------------------------------------------------
# Process one source route
# ---------------------------------------------------------

def process_source_route(
    conn,
    source_from_camera,
    source_to_camera
):
    source_congestion = get_latest_congestion(
        conn,
        source_from_camera,
        source_to_camera
    )

    # Only propagate from a congested source route.
    if source_congestion["congestion_level"] == "LOW":
        print(
            f"[SKIP] {source_from_camera} -> "
            f"{source_to_camera}: LOW congestion"
        )
        return

    downstream_routes = find_downstream_routes(
        conn,
        source_from_camera,
        source_to_camera
    )

    if not downstream_routes:
        print(
            f"[SKIP] {source_from_camera} -> "
            f"{source_to_camera}: "
            f"no downstream trajectories"
        )
        return

    for route in downstream_routes:

        downstream_from = route[0]
        downstream_to = route[1]

        flow_stats = get_flow_statistics(
            conn,
            source_from_camera,
            source_to_camera,
            downstream_from,
            downstream_to
        )

        if not flow_stats:
            continue

        downstream_congestion = get_latest_congestion(
            conn,
            downstream_from,
            downstream_to,
            source_congestion["time_window_start"]
        )

        score = calculate_propagation_score(
            source_congestion[
                "average_delay_percent"
            ],

            flow_stats[
                "downstream_probability_percent"
            ],

            flow_stats[
                "continuation_rate_percent"
            ],

            downstream_congestion[
                "average_delay_percent"
            ],

            flow_stats[
                "vehicles_with_continuation"
            ]
        )

        # Estimate how long it takes congestion
        # to propagate from the source route
        # toward the downstream route.

        estimated_impact_minutes = (
            source_congestion.get(
                "average_travel_time_seconds",
                0
            ) / 60.0
        )
        metadata = {
            "source_vehicle_count":
                flow_stats["total_source_vehicles"],

            "vehicles_with_continuation":
                flow_stats[
                    "vehicles_with_continuation"
                ],

            "downstream_vehicle_count":
                flow_stats[
                    "downstream_vehicles"
                ],

            "continuation_rate_percent":
                round(
                    flow_stats[
                        "continuation_rate_percent"
                    ],
                    2
                ),

            "evidence_level":
                score["evidence_level"],

            "evidence_factor":
                score["evidence_factor"],

            "raw_score":
                score["raw_score"],

            "source_delay_percent":
                source_congestion[
                    "average_delay_percent"
                ],

            "downstream_delay_percent":
                downstream_congestion[
                    "average_delay_percent"
                ],
        }

        store_propagation(
            conn,
            source_from_camera,
            source_to_camera,
            downstream_from,
            downstream_to,
            flow_stats[
                "downstream_probability_percent"
            ],
            source_congestion[
                "congestion_level"
            ],
            score["final_score"],
            score["propagation_level"],
            estimated_impact_minutes,
            metadata
        )

        print(
            f"[PROPAGATION] "
            f"{source_from_camera} -> "
            f"{source_to_camera}  ==>  "
            f"{downstream_from} -> "
            f"{downstream_to}"
        )

        print(
            f"  Raw score: "
            f"{score['raw_score']}"
        )

        print(
            f"  Final score: "
            f"{score['final_score']}"
        )

        print(
            f"  Level: "
            f"{score['propagation_level']}"
        )

        print(
            f"  Evidence: "
            f"{score['evidence_level']}"
        )


# ---------------------------------------------------------
# Main
# ---------------------------------------------------------

def main():

    print("=" * 60)
    print("CONGESTION PROPAGATION ENGINE")
    print("=" * 60)

    conn = get_connection()

    try:

        # Start with our known propagation chain.
        process_source_route(
            conn,
            "CAM01",
            "CAM06"
        )

    finally:
        conn.close()

    print("=" * 60)
    print("PROPAGATION PROCESS COMPLETED")
    print("=" * 60)


if __name__ == "__main__":
    main()