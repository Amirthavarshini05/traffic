import asyncio
import json
import time
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_redis_client, get_connection

def test_websocket_pipeline():
    print("=" * 60)
    print("VERIFYING MULTI-FEATURE WEBSOCKET PIPELINE")
    print("=" * 60)

    redis_client = get_redis_client(decode_responses=True)

    # 1. Publish CAMERA_HEALTH_UPDATED to Redis stream
    health_payload = {
        "event_type": "CAMERA_HEALTH_UPDATED",
        "cameras": [
            {
                "camera_id": "CAM001",
                "camera_name": "Anna Salai Junction",
                "health_status": "HEALTHY",
                "minutes_since_last_event": 1.2,
                "last_event_at": "2026-09-12T18:30:00Z"
            },
            {
                "camera_id": "CAM002",
                "camera_name": "Guindy Kathipara",
                "health_status": "WARNING",
                "minutes_since_last_event": 14.5,
                "last_event_at": "2026-09-12T18:15:00Z"
            }
        ],
        "counts": {"healthy": 8, "warning": 1, "offline": 1, "total": 10},
        "reference_time": "2026-09-12T18:30:00Z"
    }
    h_id = redis_client.xadd("camera_health_events", {"data": json.dumps(health_payload)})
    print(f"1. Published CAMERA_HEALTH_UPDATED to Redis (ID: {h_id})")

    # 2. Publish ALERT_CREATED to Redis stream
    alert_payload = {
        "event_type": "ALERT_CREATED",
        "alert_id": 9999,
        "alert_type": "ROUTE_ANOMALY",
        "severity": "CRITICAL",
        "message": "Abnormal travel time detected on Anna Salai -> Guindy",
        "vehicle_id": 101,
        "camera_id": "CAM001",
        "road_id": 5,
        "zone_id": 1,
        "status": "ACTIVE",
        "detected_at": "2026-09-12T18:30:05Z",
        "metadata": {"travel_time_seconds": 340.0, "average_travel_seconds": 120.0}
    }
    a_id = redis_client.xadd("alert_events", {"data": json.dumps(alert_payload)})
    print(f"2. Published ALERT_CREATED to Redis (ID: {a_id})")

    # 3. Publish CONGESTION_UPDATED to Redis stream
    congestion_payload = {
        "event_type": "CONGESTION_UPDATED",
        "congestion": [
            {
                "from_camera_id": "CAM001",
                "to_camera_id": "CAM002",
                "time_window_start": "2026-09-12T18:15:00Z",
                "vehicle_count": 42,
                "average_travel_time_seconds": 185.0,
                "average_delay_seconds": 65.0,
                "travel_time_index": 1.54,
                "congestion_level": "MODERATE"
            }
        ]
    }
    c_id = redis_client.xadd("congestion_events", {"data": json.dumps(congestion_payload)})
    print(f"3. Published CONGESTION_UPDATED to Redis (ID: {c_id})")

    print("\nStarting TestClient WebSocket subscriber...")
    with TestClient(app) as client:
        with client.websocket_connect("/ws/traffic") as ws:
            print("Connected to /ws/traffic WebSocket successfully!")

            received_events = set()
            start = time.time()

            while len(received_events) < 3 and (time.time() - start) < 5:
                try:
                    data = ws.receive_json()
                    event_type = data.get("event_type")
                    print(f" -> Received event over WebSocket: {event_type}")
                    received_events.add(event_type)
                except Exception as e:
                    print("Receive timeout or end:", e)
                    break

            print(f"\nTotal received event types: {received_events}")
            if "CAMERA_HEALTH_UPDATED" in received_events and "ALERT_CREATED" in received_events and "CONGESTION_UPDATED" in received_events:
                print("SUCCESS: All 3 multi-feature WebSocket event types received and verified!")
            else:
                print(f"Received subset: {received_events}")

if __name__ == "__main__":
    test_websocket_pipeline()
