import psycopg2

DB_CONFIG = {
    "host": "localhost",
    "database": "city_traffic",
    "user": "postgres",
    "password": "varsha",
    "port": 5432
}


def get_connection():
    return psycopg2.connect(**DB_CONFIG)


def get_alert_authority_assignments(conn):

    query = """
        SELECT
            a.alert_id,
            a.alert_type,
            a.severity,
            a.message,
            a.camera_id,
            c.name AS camera_name,
            z.zone_id,
            z.name AS zone_name,
            COALESCE(z.authority_name, 'UNASSIGNED') AS authority_name
        FROM alerts a

        LEFT JOIN cameras c
            ON c.camera_id = a.camera_id

        LEFT JOIN zones z
            ON ST_Within(c.location, z.boundary)

        ORDER BY a.alert_id;
    """

    with conn.cursor() as cur:
        cur.execute(query)
        return cur.fetchall()


def main():

    conn = get_connection()

    try:

        assignments = get_alert_authority_assignments(conn)

        print("\nTRAFFIC AUTHORITY ASSIGNMENT")
        print("=" * 90)

        if not assignments:
            print("No alerts found.")
            return

        for alert in assignments:

            (
                alert_id,
                alert_type,
                severity,
                message,
                camera_id,
                camera_name,
                zone_id,
                zone_name,
                authority_name
            ) = alert

            print(
                f"\nAlert ID     : {alert_id}"
            )

            print(
                f"Alert Type   : {alert_type}"
            )

            print(
                f"Severity     : {severity}"
            )

            print(
                f"Camera       : {camera_id}"
            )

            print(
                f"Camera Name  : {camera_name}"
            )

            print(
                f"Zone         : "
                f"{zone_name if zone_name else 'No mapped zone'}"
            )

            print(
                f"Authority    : {authority_name}"
            )

            print("-" * 90)

    finally:
        conn.close()


if __name__ == "__main__":
    main()