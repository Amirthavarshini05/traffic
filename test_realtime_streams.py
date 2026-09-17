import asyncio
import json
import time
from app.database import get_redis_client
from app.realtime import STREAMS, CONSUMER_GROUP, CONSUMER_NAME, manager

class MockWebSocket:
    def __init__(self, name="TestClient"):
        self.name = name
        self.received = []

    async def send_json(self, data):
        print(f"[{self.name}] received WebSocket broadcast: {data.get('event_type')}")
        self.received.append(data)

async def run_test():
    print("=" * 60)
    print("TESTING MULTI-STREAM WEBSOCKET BROADCAST ENGINE")
    print("=" * 60)

    # 1. Register Mock WebSocket Client
    mock_ws = MockWebSocket("FrontendDashboard")
    manager.active_connections.append(mock_ws)
    print(f"Registered mock WebSocket client. Active connections: {len(manager.active_connections)}")

    redis_client = get_redis_client(decode_responses=True)

    # 2. Publish to all 4 streams
    test_events = [
        (
            "trajectory_events",
            {
                "event_type": "TRAJECTORY_CREATED",
                "trajectory_id": 8881,
                "vehicle_id": "TN09BV1907",
                "from_camera_id": "CAM001",
                "to_camera_id": "CAM002",
                "travel_time_seconds": 125.0
            }
        ),
        (
            "alert_events",
            {
                "event_type": "ALERT_CREATED",
                "alert_id": 9991,
                "alert_type": "ROUTE_ANOMALY",
                "severity": "CRITICAL",
                "message": "Speeding detour alert on Guindy corridor",
                "vehicle_id": 104,
                "camera_id": "CAM002",
                "status": "ACTIVE"
            }
        ),
        (
            "camera_health_events",
            {
                "event_type": "CAMERA_HEALTH_UPDATED",
                "cameras": [
                    {"camera_id": "CAM001", "health_status": "HEALTHY", "minutes_since_last_event": 0.5},
                    {"camera_id": "CAM002", "health_status": "WARNING", "minutes_since_last_event": 16.0}
                ],
                "counts": {"healthy": 8, "warning": 1, "offline": 1}
            }
        ),
        (
            "congestion_events",
            {
                "event_type": "CONGESTION_UPDATED",
                "congestion": [
                    {
                        "from_camera_id": "CAM001",
                        "to_camera_id": "CAM002",
                        "congestion_level": "HIGH",
                        "average_delay_seconds": 95.0
                    }
                ]
            }
        )
    ]

    for stream, payload in test_events:
        msg_id = redis_client.xadd(stream, {"data": json.dumps(payload)})
        print(f"Published to {stream} -> Event: {payload['event_type']} (ID: {msg_id})")

    # 3. Read from streams using the exact logic from app/realtime.py
    streams_query = {s: ">" for s in STREAMS}
    messages = await asyncio.to_thread(
        redis_client.xreadgroup,
        groupname=CONSUMER_GROUP,
        consumername=CONSUMER_NAME,
        streams=streams_query,
        count=10,
        block=2000
    )

    print(f"\nRead messages from {len(messages)} stream(s):")
    for stream_name, entries in messages:
        for redis_message_id, fields in entries:
            data = json.loads(fields["data"])
            print(f" -> Consumed from {stream_name}: {data.get('event_type')}")
            await manager.broadcast(data)
            redis_client.xack(stream_name, CONSUMER_GROUP, redis_message_id)

    # 4. Verify all received
    received_types = {d["event_type"] for d in mock_ws.received}
    print("\n" + "=" * 60)
    print("VERIFICATION SUMMARY")
    print("=" * 60)
    print(f"Mock WebSocket received {len(mock_ws.received)} events: {received_types}")

    expected_types = {"TRAJECTORY_CREATED", "ALERT_CREATED", "CAMERA_HEALTH_UPDATED", "CONGESTION_UPDATED"}
    missing = expected_types - received_types
    if not missing:
        print("PASS: All 4 multi-feature event types were successfully multiplexed and broadcasted!")
    else:
        print(f"NOTE: Missing types: {missing}")

if __name__ == "__main__":
    asyncio.run(run_test())
