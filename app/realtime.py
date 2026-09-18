import asyncio
import json
import redis

from fastapi import WebSocket
from app.database import get_redis_client


# =========================================================
# =========================================================
# Redis Configuration
# =========================================================

STREAMS = [
    "trajectory_events",
    "alert_events",
    "camera_health_events",
    "congestion_events"
]
CONSUMER_GROUP = "dashboard_realtime"
CONSUMER_NAME = "dashboard_realtime_01"


# =========================================================
# Redis Connection
# =========================================================

redis_client = get_redis_client(decode_responses=True, socket_timeout=None)


# =========================================================
# WebSocket Connection Manager
# =========================================================

class ConnectionManager:

    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        disconnected = []

        for websocket in self.active_connections:
            try:
                await websocket.send_json(message)
            except Exception:
                disconnected.append(websocket)

        for websocket in disconnected:
            self.disconnect(websocket)


manager = ConnectionManager()


# =========================================================
# Create Redis Consumer Groups for all streams
# =========================================================

for stream in STREAMS:
    try:
        redis_client.xgroup_create(
            stream,
            CONSUMER_GROUP,
            id="$",
            mkstream=True
        )
        print(f"Created Redis consumer group '{CONSUMER_GROUP}' on stream '{stream}'")

    except redis.exceptions.ResponseError as e:
        if "BUSYGROUP" in str(e):
            pass
        else:
            print(f"Note creating consumer group on '{stream}': {e}")


# =========================================================
# Redis → WebSocket Worker (Multiplexes all system events)
# =========================================================

async def redis_trajectory_listener():

    print("=" * 60)
    print("REALTIME MULTI-FEATURE DASHBOARD LISTENER")
    print("=" * 60)
    print(f"Listening to Redis streams: {', '.join(STREAMS)}")
    print(f"Consumer group: {CONSUMER_GROUP}")

    streams_query = {s: ">" for s in STREAMS}

    print(
        "Consumer:",
        CONSUMER_NAME
    )

    while True:

        try:
            messages = await asyncio.to_thread(
                redis_client.xreadgroup,
                groupname=CONSUMER_GROUP,
                consumername=CONSUMER_NAME,
                streams=streams_query,
                count=10,
                block=2000
            )

            if not messages:
                await asyncio.sleep(0.01)
                continue

            for stream_name, entries in messages:

                for redis_message_id, fields in entries:

                    try:
                        data = json.loads(fields["data"])

                        event_type = data.get("event_type", "UNKNOWN")
                        print(f"\nDashboard realtime event [{event_type}] from {stream_name}")


                        # --------------------------------
                        # Broadcast to WebSocket clients
                        # --------------------------------

                        await manager.broadcast(data)


                        # --------------------------------
                        # ACK Redis message
                        # --------------------------------

                        redis_client.xack(
                            stream_name,
                            CONSUMER_GROUP,
                            redis_message_id
                        )

                    except Exception as e:
                        print(f"Dashboard realtime event error on {stream_name}:", e)

        except Exception as e:
            print("Redis realtime listener error:", e)
            await asyncio.sleep(1)