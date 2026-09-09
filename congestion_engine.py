from app.database import get_connection

def process_historical_congestion():

    conn = get_connection()

    try:
        cursor = conn.cursor()

        query = """
            WITH route_baselines AS (
                SELECT
                    from_camera_id,
                    to_camera_id,
                    MIN(travel_time_seconds)
                        AS baseline_travel_time_seconds
                FROM trajectories
                GROUP BY
                    from_camera_id,
                    to_camera_id
            ),

            bucketed_stats AS (
                SELECT
                    from_camera_id,
                    to_camera_id,

                    date_trunc('hour', started_at)
                    + floor(EXTRACT(MINUTE FROM started_at) / 15)
                      * INTERVAL '15 minutes'
                    AS time_window_start,

                    COUNT(*) AS vehicle_count,

                    AVG(travel_time_seconds)
                        AS average_travel_time_seconds

                FROM trajectories

                GROUP BY
                    from_camera_id,
                    to_camera_id,
                    date_trunc('hour', started_at)
                    + floor(EXTRACT(MINUTE FROM started_at) / 15)
                      * INTERVAL '15 minutes'
            ),

            metrics AS (
                SELECT
                    b.from_camera_id,
                    b.to_camera_id,
                    b.time_window_start,
                    b.vehicle_count,
                    r.baseline_travel_time_seconds,
                    b.average_travel_time_seconds,

                    b.average_travel_time_seconds
                    - r.baseline_travel_time_seconds
                    AS average_delay_seconds,

                    (
                        b.average_travel_time_seconds
                        - r.baseline_travel_time_seconds
                    )
                    / NULLIF(
                        r.baseline_travel_time_seconds,
                        0
                    ) * 100
                    AS average_delay_percent

                FROM bucketed_stats b

                JOIN route_baselines r
                    ON b.from_camera_id = r.from_camera_id
                   AND b.to_camera_id = r.to_camera_id
            )

            INSERT INTO historical_congestion (
                from_camera_id,
                to_camera_id,
                time_window_start,
                time_window_end,
                vehicle_count,
                baseline_travel_time_seconds,
                average_travel_time_seconds,
                average_delay_seconds,
                average_delay_percent,
                congestion_level
            )

            SELECT
                from_camera_id,
                to_camera_id,
                time_window_start,
                time_window_start + INTERVAL '15 minutes',
                vehicle_count,
                baseline_travel_time_seconds,
                average_travel_time_seconds,
                average_delay_seconds,
                average_delay_percent,

                CASE
                    WHEN average_delay_percent <= 10
                        THEN 'LOW'

                    WHEN average_delay_percent <= 25
                        THEN 'MEDIUM'

                    WHEN average_delay_percent <= 50
                        THEN 'HIGH'

                    ELSE 'SEVERE'
                END

            FROM metrics

            ON CONFLICT (
                from_camera_id,
                to_camera_id,
                time_window_start,
                time_window_end
            )

            DO UPDATE SET
                vehicle_count = EXCLUDED.vehicle_count,
                baseline_travel_time_seconds =
                    EXCLUDED.baseline_travel_time_seconds,
                average_travel_time_seconds =
                    EXCLUDED.average_travel_time_seconds,
                average_delay_seconds =
                    EXCLUDED.average_delay_seconds,
                average_delay_percent =
                    EXCLUDED.average_delay_percent,
                congestion_level =
                    EXCLUDED.congestion_level;
        """

        cursor.execute(query)

        conn.commit()

        print("Historical congestion processing completed.")

        cursor.close()

    finally:
        conn.close()


if __name__ == "__main__":
    process_historical_congestion()