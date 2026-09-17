import psycopg2
import json
import time
from app.database import get_connection, get_redis_client

def test_alert_trigger():
    print("=" * 60)
    print("TESTING POSTGRESQL ALERT TRIGGER NOTIFICATION")
    print("=" * 60)

    conn = get_connection()
    conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = conn.cursor()

    cursor.execute("LISTEN alert_created;")
    print("Listening for PostgreSQL 'alert_created' channel...")

    # Insert test alert
    insert_sql = """
        INSERT INTO alerts (
            alert_type,
            severity,
            message,
            camera_id,
            status,
            detected_at,
            metadata
        ) VALUES (
            'TEST_SPEED_ANOMALY',
            'HIGH',
            'Test real-time alert trigger verification',
            'CAM001',
            'ACTIVE',
            NOW(),
            '{"speed_kmh": 94.2}'::jsonb
        ) RETURNING alert_id;
    """
    cursor.execute(insert_sql)
    inserted_id = cursor.fetchone()[0]
    print(f"Inserted test alert with ID: {inserted_id}")

    # Check notification
    received = False
    start = time.time()
    while time.time() - start < 5:
        conn.poll()
        if conn.notifies:
            notify = conn.notifies.pop(0)
            print(f"SUCCESS: Received notification on channel: {notify.channel}")
            payload = json.loads(notify.payload)
            print(f"Payload alert_id: {payload.get('alert_id')}, alert_type: {payload.get('alert_type')}")
            received = True
            break
        time.sleep(0.1)

    # Clean up test row
    cursor.execute("DELETE FROM alerts WHERE alert_id = %s;", (inserted_id,))
    print(f"Cleaned up test alert #{inserted_id}")

    cursor.close()
    conn.close()

    if received:
        print("PASS: PostgreSQL alert_created notification trigger verified successfully!")
    else:
        print("FAIL: No notification received within timeout.")

if __name__ == "__main__":
    test_alert_trigger()
