import psycopg2
from app.database import get_connection

def setup_triggers():
    conn = get_connection()
    conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = conn.cursor()

    print("Connected to PostgreSQL database.")

    # 1. Trajectory notification trigger
    cursor.execute("""
        CREATE OR REPLACE FUNCTION notify_trajectory_created()
        RETURNS trigger AS $$
        BEGIN
            PERFORM pg_notify('trajectory_created', row_to_json(NEW)::text);
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    cursor.execute("DROP TRIGGER IF EXISTS trigger_trajectory_created ON trajectories;")
    cursor.execute("""
        CREATE TRIGGER trigger_trajectory_created
        AFTER INSERT ON trajectories
        FOR EACH ROW EXECUTE FUNCTION notify_trajectory_created();
    """)
    print("Trigger trigger_trajectory_created on trajectories installed.")

    # 2. Alert notification trigger
    cursor.execute("""
        CREATE OR REPLACE FUNCTION notify_alert_created()
        RETURNS trigger AS $$
        BEGIN
            PERFORM pg_notify('alert_created', row_to_json(NEW)::text);
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    cursor.execute("DROP TRIGGER IF EXISTS trigger_alert_created ON alerts;")
    cursor.execute("""
        CREATE TRIGGER trigger_alert_created
        AFTER INSERT ON alerts
        FOR EACH ROW EXECUTE FUNCTION notify_alert_created();
    """)
    print("Trigger trigger_alert_created on alerts installed.")

    # 3. Check trigger status
    cursor.execute("""
        SELECT trigger_name, event_manipulation, event_object_table
        FROM information_schema.triggers
        WHERE event_object_table IN ('trajectories', 'alerts');
    """)
    triggers = cursor.fetchall()
    print("Active triggers on trajectories and alerts:")
    for t in triggers:
        print(f" - {t[0]} on {t[2]} ({t[1]})")

    cursor.close()
    conn.close()

if __name__ == "__main__":
    setup_triggers()
