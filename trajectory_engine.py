from app.database import get_connection
import json


MAX_SPEED_KMH = 120
NO_HISTORY_CONFIDENCE_FACTOR = 0.85


def find_previous_event(cursor, vehicle_id, event_id, observed_at, camera_id):
    query = """
        SELECT
            event_id,
            vehicle_id,
            camera_id,
            observed_at,
            confidence,
            location
        FROM events
        WHERE vehicle_id = %s
          AND event_id <> %s
          AND observed_at < %s
          AND camera_id <> %s
        ORDER BY
            observed_at DESC,
            event_id DESC
        LIMIT 1;
    """

    cursor.execute(
        query,
        (vehicle_id, event_id, observed_at, camera_id)
    )

    return cursor.fetchone()


def find_camera_route(cursor, from_camera_id, to_camera_id):
    query = """
        SELECT
            route_id,
            starting_node,
            ending_node,
            road_list,
            total_distance_m,
            geometry
        FROM camera_routes
        WHERE starting_node = %s
          AND ending_node = %s
        ORDER BY route_id
        LIMIT 1;
    """

    cursor.execute(
        query,
        (from_camera_id, to_camera_id)
    )

    return cursor.fetchone()


def find_route_stats(cursor, from_camera_id, to_camera_id):
    query = """
        SELECT
            average_travel_seconds,
            stddev_travel_seconds,
            sample_count
        FROM route_travel_stats
        WHERE starting_camera_id = %s
          AND ending_camera_id = %s
        LIMIT 1;
    """

    cursor.execute(
        query,
        (from_camera_id, to_camera_id)
    )

    return cursor.fetchone()


def calculate_confidence(
    previous_confidence,
    current_confidence,
    has_historical_stats
):
    previous_confidence = float(previous_confidence or 0)
    current_confidence = float(current_confidence or 0)

    confidence = (
        previous_confidence +
        current_confidence
    ) / 2.0

    if not has_historical_stats:
        confidence *= NO_HISTORY_CONFIDENCE_FACTOR

    confidence = round(confidence, 2)

    return max(0, min(confidence, 1))


def create_trajectory(event):
    """
    Process one newly received ANPR event.

    This function is intentionally reusable so that
    Redis Streams can call it later.
    """

    conn = get_connection()

    try:
        cursor = conn.cursor()

        event_id = event["event_id"]
        vehicle_id = event["vehicle_id"]
        camera_id = event["camera_id"]
        observed_at = event["observed_at"]
        current_confidence = event.get("confidence")

        # ==========================================================
        # 1. Find previous observation of same vehicle
        # ==========================================================

        previous_event = find_previous_event(
            cursor,
            vehicle_id,
            event_id,
            observed_at,
            camera_id
        )

        if not previous_event:
            print(
                f"No previous event for vehicle {vehicle_id}. "
                f"Nothing to reconstruct."
            )

            return None

        (
            previous_event_id,
            previous_vehicle_id,
            previous_camera_id,
            previous_observed_at,
            previous_confidence,
            previous_location
        ) = previous_event

        # ==========================================================
        # 2. Calculate actual travel time
        # ==========================================================

        actual_travel_seconds = (
            observed_at - previous_observed_at
        ).total_seconds()

        if actual_travel_seconds <= 0:
            print(
                f"Invalid travel time for vehicle {vehicle_id}."
            )

            return None

        # ==========================================================
        # 3. Find predefined camera-to-camera route
        # ==========================================================

        route = find_camera_route(
            cursor,
            previous_camera_id,
            camera_id
        )

        if not route:
            print(
                f"No predefined route: "
                f"{previous_camera_id} -> {camera_id}"
            )

            return None

        (
            route_id,
            starting_node,
            ending_node,
            road_list,
            total_distance_m,
            route_geometry
        ) = route
        total_distance_m = float(total_distance_m)
        road_list = json.dumps(road_list)

        # ==========================================================
        # 4. Physical feasibility check
        # ==========================================================

        if total_distance_m is None or total_distance_m <= 0:
            print(
                f"Invalid route distance: "
                f"{previous_camera_id} -> {camera_id}"
            )

            return None

        max_speed_mps = MAX_SPEED_KMH * 1000 / 3600

        minimum_physical_time_seconds = (
            float(total_distance_m) / max_speed_mps
        )

        if actual_travel_seconds < minimum_physical_time_seconds:

            print(
                f"Trajectory rejected: physically impossible. "
                f"{previous_camera_id} -> {camera_id}. "
                f"Actual={actual_travel_seconds:.0f}s, "
                f"minimum={minimum_physical_time_seconds:.0f}s"
            )

            return None

        # ==========================================================
        # 5. Get historical route statistics
        # ==========================================================

        route_stats = find_route_stats(
            cursor,
            previous_camera_id,
            camera_id
        )

        has_historical_stats = False

        # ==========================================================
        # 6. Historical validation
        # ==========================================================

        if (
            route_stats
            and route_stats[0] is not None
            and route_stats[2] >= 1
        ):

            has_historical_stats = True

            average_travel_seconds = float(route_stats[0])
            stddev_travel_seconds = (
                float(route_stats[1])
                if route_stats[1] is not None
                else None
            )
            sample_count = route_stats[2]

            # ----------------------------------------------
            # Percentage range: Average ±20%
            # ----------------------------------------------

            percentage_lower = (
                average_travel_seconds * 0.80
            )

            percentage_upper = (
                average_travel_seconds * 1.20
            )

            # ----------------------------------------------
            # Statistical range: Average ±2σ
            # ----------------------------------------------

            if (
                sample_count >= 5
                and stddev_travel_seconds is not None
            ):

                statistical_lower = max(
                    average_travel_seconds -
                    (2 * stddev_travel_seconds),
                    0
                )

                statistical_upper = (
                    average_travel_seconds +
                    (2 * stddev_travel_seconds)
                )

                # Use wider range
                final_lower = min(
                    percentage_lower,
                    statistical_lower
                )

                final_upper = max(
                    percentage_upper,
                    statistical_upper
                )

            else:

                final_lower = percentage_lower
                final_upper = percentage_upper

            # ----------------------------------------------
            # Validate against historical behavior
            # ----------------------------------------------

            if (
                actual_travel_seconds < final_lower
                or actual_travel_seconds > final_upper
            ):

                print(
                    f"Trajectory rejected: historical validation. "
                    f"{previous_camera_id} -> {camera_id}. "
                    f"Actual={actual_travel_seconds:.0f}s, "
                    f"valid range="
                    f"{final_lower:.0f}-{final_upper:.0f}s"
                )

                return None

        else:

            print(
                f"No historical statistics: "
                f"{previous_camera_id} -> {camera_id}. "
                f"Accepting with lower confidence."
            )

        # ==========================================================
        # 7. Calculate trajectory confidence
        # ==========================================================

        trajectory_confidence = calculate_confidence(
            previous_confidence,
            current_confidence,
            has_historical_stats
        )

        # ==========================================================
        # 8. Find previous trajectory for chaining
        # ==========================================================

        previous_trajectory_query = """
            SELECT trajectory_id
            FROM trajectories
            WHERE vehicle_id = %s
              AND to_camera_id = %s
              AND end_event_id = %s
            ORDER BY ended_at DESC
            LIMIT 1;
        """

        cursor.execute(
            previous_trajectory_query,
            (
                int(previous_vehicle_id),
                previous_camera_id,
                previous_event_id
            )
        )

        previous_trajectory = cursor.fetchone()

        previous_trajectory_id = (
            previous_trajectory[0]
            if previous_trajectory
            else None
        )

        # ==========================================================
        # 9. Create trajectory
        # ==========================================================

        insert_query = """
            INSERT INTO trajectories (
                vehicle_id,
                start_event_id,
                end_event_id,
                from_camera_id,
                to_camera_id,
                started_at,
                ended_at,
                travel_time_seconds,
                distance_m,
                road_sequence,
                geometry,
                inference_method,
                confidence
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                ST_LineMerge(%s),
                %s,
                %s
            )
            RETURNING trajectory_id;
        """

        cursor.execute(
            insert_query,
            (
                int(vehicle_id),
                previous_event_id,
                event_id,
                previous_camera_id,
                camera_id,
                previous_observed_at,
                observed_at,
                actual_travel_seconds,
                total_distance_m,
                road_list,
                route_geometry,
                "PREDEFINED_CAMERA_ROUTE",
                trajectory_confidence
            )
        )

        new_trajectory_id = cursor.fetchone()[0]

        # ==========================================================
        # 10. Link trajectories
        # ==========================================================

        if previous_trajectory_id is not None:

            update_previous = """
                UPDATE trajectories
                SET next_trajectory_id = %s
                WHERE trajectory_id = %s;
            """

            cursor.execute(
                update_previous,
                (
                    new_trajectory_id,
                    previous_trajectory_id
                )
            )

            update_current = """
                UPDATE trajectories
                SET prev_trajectory_id = %s
                WHERE trajectory_id = %s;
            """

            cursor.execute(
                update_current,
                (
                    previous_trajectory_id,
                    new_trajectory_id
                )
            )

        conn.commit()

        print(
            f"Trajectory created: "
            f"{new_trajectory_id} | "
            f"Vehicle {vehicle_id} | "
            f"{previous_camera_id} -> {camera_id} | "
            f"{actual_travel_seconds:.0f}s | "
            f"{total_distance_m}m | "
            f"confidence={trajectory_confidence}"
        )

        return new_trajectory_id

    except Exception as error:

        conn.rollback()

        print(
            f"Trajectory reconstruction failed "
            f"for event {event.get('event_id')}: {error}"
        )

        return None

    finally:

        conn.close()