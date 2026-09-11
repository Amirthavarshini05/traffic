import os
import json
import redis
from datetime import datetime, timezone


# --------------------------------------------------
# Redis connection
# --------------------------------------------------

redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "localhost"),
    port=int(os.getenv("REDIS_PORT", "6379")),
    decode_responses=True
)

STREAM_NAME = "anpr_events"


# --------------------------------------------------
# Publish normalized ANPR event
# --------------------------------------------------

def publish_anpr_event(payload):

    if isinstance(payload, str):
        payload = json.loads(payload)

    stream_id = redis_client.xadd(
        STREAM_NAME,
        {
            "data": json.dumps(payload)
        }
    )

    print("ANPR event published!")
    print("Stream ID:", stream_id)
    print("Event:", payload)

    return stream_id


# --------------------------------------------------
# Test
# --------------------------------------------------

if __name__ == "__main__":

    sample_event = {
        "camera_id": "CAM01",
        "plate": "TN01AB1234",
        "timestamp": datetime.now(
            timezone.utc
        ).isoformat(),
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