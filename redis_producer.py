import os
import json
<<<<<<< HEAD
import os
import redis
from datetime import datetime, timezone
from dotenv import load_dotenv
=======
from datetime import datetime, timezone
from app.database import get_redis_client
>>>>>>> a9331665902c117f4454d08a61250aaf29124ea5

load_dotenv()

# --------------------------------------------------
# Redis connection
# --------------------------------------------------

<<<<<<< HEAD
redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST"),
    port=int(os.getenv("REDIS_PORT", "6379")),
    username=os.getenv("REDIS_USERNAME", "default"),
    password=os.getenv("REDIS_PASSWORD"),
    ssl=os.getenv("REDIS_SSL", "false").lower() == "true",
    decode_responses=True
)
=======
redis_client = get_redis_client(decode_responses=True)
>>>>>>> a9331665902c117f4454d08a61250aaf29124ea5

STREAM_NAME = "anpr_events"


def publish_anpr_event(payload):
    if isinstance(payload, str):
        payload = json.loads(payload)

    stream_id = redis_client.xadd(
        STREAM_NAME,
        {"data": json.dumps(payload)}
    )

    print("ANPR event published!")
    print("Stream ID:", stream_id)
    print("Event:", payload)

    return stream_id


if __name__ == "__main__":
    sample_event = {
        "camera_id": "CAM01",
        "plate": "TN01AB1234",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "confidence": 0.95,
        "latitude": 13.0213,
        "longitude": 80.2212,
        "vehicle_type": "Car",
        "make": "Toyota",
        "model": "Camry",
        "color": "White",
        "heading": 180.0
    }

    publish_anpr_event(sample_event)