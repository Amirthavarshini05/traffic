import asyncio
import json
import redis

from fastapi import WebSocket
from app.database import get_redis_client


# =========================================================
# Redis Configuration
# =========================================================

TRAJECTORY_STREAM = "trajectory_events"
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

    while True:

        try:

            '''messages = redis_client.xreadgroup(
                groupname=CONSUMER_GROUP,
                consumername=CONSUMER_NAME,
                streams={
                    TRAJECTORY_STREAM: ">"
                },
                count=1,
                block=5000
            )'''

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

                        data = json.loads(
                            fields["data"]
                        )

                        print(
                            "\nDashboard realtime event:"
                        )
                        print(data)

                        await manager.broadcast(data)

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