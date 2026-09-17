import asyncio
import json
<<<<<<< HEAD
import os

import redis
from dotenv import load_dotenv
=======
import redis

>>>>>>> a9331665902c117f4454d08a61250aaf29124ea5
from fastapi import WebSocket
from app.database import get_redis_client


# =========================================================
<<<<<<< HEAD
# Load environment variables
# =========================================================

load_dotenv()


=======
>>>>>>> a9331665902c117f4454d08a61250aaf29124ea5
# =========================================================
# Redis Configuration
# =========================================================

<<<<<<< HEAD
REDIS_HOST = os.getenv("REDIS_HOST")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_USERNAME = os.getenv("REDIS_USERNAME", "default")
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")
REDIS_SSL = os.getenv("REDIS_SSL", "false").lower() == "true"

TRAJECTORY_STREAM = "trajectory_events"
=======
STREAMS = [
    "trajectory_events",
    "alert_events",
    "camera_health_events",
    "congestion_events"
]
>>>>>>> a9331665902c117f4454d08a61250aaf29124ea5
CONSUMER_GROUP = "dashboard_realtime"
CONSUMER_NAME = "dashboard_realtime_01"


# =========================================================
# Redis Connection
# =========================================================

<<<<<<< HEAD
redis_client = redis.Redis(
    host=REDIS_HOST,
    port=REDIS_PORT,
    username=REDIS_USERNAME,
    password=REDIS_PASSWORD,
    ssl=REDIS_SSL,
    decode_responses=True,
    socket_timeout=None
)
=======
redis_client = get_redis_client(decode_responses=True, socket_timeout=None)
>>>>>>> a9331665902c117f4454d08a61250aaf29124ea5


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

<<<<<<< HEAD
try:

    redis_client.xgroup_create(
        TRAJECTORY_STREAM,
        CONSUMER_GROUP,
        id="0",
        mkstream=True
    )

    print(
        "Created Redis consumer group:",
        CONSUMER_GROUP
    )

except redis.exceptions.ResponseError as e:

    if "BUSYGROUP" in str(e):

        print(
            "Redis consumer group already exists."
        )

    else:
        raise
=======
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
>>>>>>> a9331665902c117f4454d08a61250aaf29124ea5


# =========================================================
# Redis → WebSocket Worker (Multiplexes all system events)
# =========================================================

async def redis_trajectory_listener():

    print("=" * 60)
    print("REALTIME MULTI-FEATURE DASHBOARD LISTENER")
    print("=" * 60)
<<<<<<< HEAD

    print(
        "Listening to Redis stream:",
        TRAJECTORY_STREAM
    )

    print(
        "Consumer group:",
        CONSUMER_GROUP
    )
=======
    print(f"Listening to Redis streams: {', '.join(STREAMS)}")
    print(f"Consumer group: {CONSUMER_GROUP}")

    streams_query = {s: ">" for s in STREAMS}
>>>>>>> a9331665902c117f4454d08a61250aaf29124ea5

    print(
        "Consumer:",
        CONSUMER_NAME
    )

    while True:

        try:
<<<<<<< HEAD

=======
>>>>>>> a9331665902c117f4454d08a61250aaf29124ea5
            messages = await asyncio.to_thread(
                redis_client.xreadgroup,
                groupname=CONSUMER_GROUP,
                consumername=CONSUMER_NAME,
<<<<<<< HEAD
                streams={
                    TRAJECTORY_STREAM: ">"
                },
                count=1,
                block=5000
=======
                streams=streams_query,
                count=10,
                block=2000
>>>>>>> a9331665902c117f4454d08a61250aaf29124ea5
            )

            if not messages:
                await asyncio.sleep(0.01)
                continue

            for stream_name, entries in messages:

                for redis_message_id, fields in entries:

                    try:
                        data = json.loads(fields["data"])

<<<<<<< HEAD
                        # --------------------------------
                        # Read trajectory event
                        # --------------------------------

                        data = json.loads(
                            fields["data"]
                        )

                        print(
                            "\nDashboard realtime event:"
                        )

                        print(data)
=======
                        event_type = data.get("event_type", "UNKNOWN")
                        print(f"\nDashboard realtime event [{event_type}] from {stream_name}")
>>>>>>> a9331665902c117f4454d08a61250aaf29124ea5


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