import json
from datetime import datetime
import psycopg2

def ingest_anpr_event(conn, payload):
    """
    Ingests a normalized JSON ANPR event payload into PostgreSQL/PostGIS.
    Contract schema:
    {
      "camera_id": "CAM01",
      "plate": "TN01AB1234",
      "timestamp": "2026-09-05T10:00:00Z",
      "confidence": 0.96,
      "latitude": 13.0213,
      "longitude": 80.2212,
      "vehicle_type": "Car",      -- optional
      "make": "Toyota",            -- optional
      "model": "Camry",            -- optional
      "color": "White",            -- optional
      "heading": 180.0             -- optional
    }
    """
    if isinstance(payload, str):
        data = json.loads(payload)
    else:
        data = payload

    camera_id = data.get("camera_id")
    plate = data.get("plate")
    timestamp_str = data.get("timestamp")
    confidence = data.get("confidence")
    lat = data.get("latitude")
    lng = data.get("longitude")
    
    vehicle_type = data.get("vehicle_type", "Unknown")
    make = data.get("make")
    model = data.get("model")
    color = data.get("color")
    heading = data.get("heading", 0.0)

    cur = conn.cursor()

    # 1. Upsert into vehicles table
    cur.execute("""
        INSERT INTO vehicles (plate_number)
        VALUES (%s)
        ON CONFLICT (plate_number) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
        RETURNING vehicle_id;
    """, (plate,))
    vehicle_id = cur.fetchone()[0]

    # 2. Insert into events table with PostGIS Point
    cur.execute("""
        INSERT INTO events (
            vehicle_id, camera_id, plate_number, vehicle_type, make, model, color,
            observed_at, confidence, heading, location, raw_data
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
            ST_SetSRID(ST_MakePoint(%s, %s), 4326),
            %s
        ) RETURNING event_id;
    """, (
        vehicle_id, camera_id, plate, vehicle_type, make, model, color,
        timestamp_str, confidence, heading, lng, lat,
        json.dumps(data)
    ))
    
    event_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    return {
        "event_id": event_id,
        "vehicle_id": vehicle_id,
        "camera_id": camera_id,
        "plate": plate,
        "observed_at": timestamp_str,
        "confidence": confidence
    }

if __name__ == "__main__":
    # Test JSON event ingestion sample
    sample_json = {
        "camera_id": "CAM01",
        "plate": "TN01AB1234",
        "timestamp": datetime.now().isoformat(),
        "confidence": 98.50,
        "latitude": 13.0068,
        "longitude": 80.2045,
        "vehicle_type": "Car",
        "make": "Hyundai",
        "model": "Creta",
        "color": "White",
        "heading": 45.0
    }
    print("Sample JSON Contract:", json.dumps(sample_json, indent=2))
