import asyncio
import json
import os

import redis
from dotenv import load_dotenv
from fastapi import WebSocket


# =========================================================
# Load environment variables
# =========================================================

load_dotenv()


# =========================================================
# Redis Configuration
# =========================================================

REDIS_HOST = os.getenv("REDIS_HOST")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_USERNAME = os.getenv("REDIS_USERNAME", "default")
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")
REDIS_SSL = os.getenv("REDIS_SSL", "false").lower() == "true"

TRAJECTORY_STREAM = "trajectory_events"
CONSUMER_GROUP = "dashboard_realtime"
CONSUMER_NAME = "dashboard_realtime_01"


# =========================================================
# Redis Connection
# =========================================================

redis_client = redis.Redis(
    host=REDIS_HOST,
    port=REDIS_PORT,
    username=REDIS_USERNAME,
    password=REDIS_PASSWORD,
    ssl=REDIS_SSL,
    decode_responses=True,
    socket_timeout=None
)


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
# Create Redis Consumer Group
# =========================================================

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


# =========================================================
# Redis → WebSocket Worker
# =========================================================

async def redis_trajectory_listener():

    print("=" * 60)
    print("REALTIME DASHBOARD LISTENER")
    print("=" * 60)

    print(
        "Listening to Redis stream:",
        TRAJECTORY_STREAM
    )

    print(
        "Consumer group:",
        CONSUMER_GROUP
    )

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
                streams={
                    TRAJECTORY_STREAM: ">"
                },
                count=1,
                block=5000
            )

            if not messages:
                await asyncio.sleep(0.01)
                continue

            for stream_name, entries in messages:

                for redis_message_id, fields in entries:

                    try:

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


                        # --------------------------------
                        # Broadcast to WebSocket clients
                        # --------------------------------

                        await manager.broadcast(data)


                        # --------------------------------
                        # ACK Redis message
                        # --------------------------------

                        redis_client.xack(
                            TRAJECTORY_STREAM,
                            CONSUMER_GROUP,
                            redis_message_id
                        )

                        print(
                            "Dashboard event ACK:",
                            redis_message_id
                        )

                    except Exception as e:

                        print(
                            "Dashboard realtime "
                            "event error:",
                            e
                        )

        except Exception as e:

            print(
                "Redis realtime listener error:",
                e
            )

            await asyncio.sleep(1)