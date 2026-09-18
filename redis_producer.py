import os
import json
from datetime import datetime, timezone
from app.database import get_redis_client
from dotenv import load_dotenv
load_dotenv()

# --------------------------------------------------
# Redis connection
# --------------------------------------------------

redis_client = get_redis_client(decode_responses=True)

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