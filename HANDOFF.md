# 📦 Team Integration & Handoff Guide

## 1. Team Responsibilities & System Boundary

This project is divided into two distinct, decoupled tracks:

```text
       MEMBER 1 (CV / AI / ML / NLP)
                   │
                   ▼
          Video → YOLO → OCR
        Multi-Camera Matching
                   │
                   ▼
        Normalized ANPR Event
                   │
                   ▼
       Redis Stream: anpr_events
═══════════════════╪═══════════════════ (System Boundary)
                   │
                   ▼
     MEMBER 2 (Platform & Analytics)
                   │
                   ▼
     PostgreSQL + PostGIS Ingestion
        Trajectory Reconstruction
     OD Engine • Congestion • Alerts
                   │
                   ▼
      FastAPI Endpoints / WebSocket
                   │
                   ▼
      React + MapLibre Command Center
```

* **Member 1 (You)** owns the perception and edge analytics: YOLO vehicle detection, plate OCR, multi-camera vehicle matching, congestion forecasting models, and natural language query processing.
* **Member 2 (Teammate)** owns the centralized platform: event streaming, database persistence, spatial trajectory reconstruction, network health, incident alerts, REST/WebSocket APIs, and the command dashboard.

---

## 2. The Non-Negotiable Data Contract

Whenever your AI pipeline identifies a vehicle observation, publish this normalized JSON structure to Redis stream **`anpr_events`** using `redis_producer.py`:

```json
{
  "camera_id": "CAM01",
  "plate": "TN01AB1234",
  "timestamp": "2026-09-12T10:00:00Z",
  "confidence": 0.96,
  "latitude": 13.0068,
  "longitude": 80.2045,
  "vehicle_type": "Car",
  "make": "Toyota",
  "model": "Camry",
  "color": "White",
  "heading": 180.0
}
```

### Field Specifications
| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `camera_id` | string | ✅ | Identifier of the camera node (`CAM01` to `CAM10`). |
| `plate` | string | ✅ | OCR plate text string (e.g. `TN01AB1234`). |
| `timestamp` | string (ISO-8601) | ✅ | UTC observation timestamp (e.g. `2026-09-12T10:00:00Z`). |
| `confidence` | number (0.0–1.0) | ✅ | Normalized detection confidence score. |
| `latitude` | float | ✅ | Latitude coordinate of the camera node. |
| `longitude` | float | ✅ | Longitude coordinate of the camera node. |
| `vehicle_type` | string | 🟡 | `Car`, `Motorcycle`, `Bus`, `Truck`, `Auto`. |
| `make` | string | ⚪ | Vehicle manufacturer (optional). |
| `model` | string | ⚪ | Vehicle model name (optional). |
| `color` | string | ⚪ | Vehicle exterior color (optional). |
| `heading` | float | ⚪ | Vehicle orientation heading in degrees (0.0 to 360.0). |

---

## 3. How Member 1 Publishes Events

You do **not** need to manually insert into PostgreSQL or write SQL. Simply import `publish_anpr_event` from `redis_producer.py`:

```python
from redis_producer import publish_anpr_event

event = {
    "camera_id": "CAM01",
    "plate": "TN01AB1234",
    "timestamp": "2026-09-12T10:00:00Z",
    "confidence": 0.96,
    "latitude": 13.0068,
    "longitude": 80.2045,
    "vehicle_type": "Car"
}

stream_id = publish_anpr_event(event)
```

To reconstruct a trajectory, send consecutive observations for the same license plate across different cameras with sequential timestamps:
* Observation 1: `TN01AB1234` at `CAM01` at `10:00:00`
* Observation 2: `TN01AB1234` at `CAM02` at `10:05:00`

---

## 4. Live Shared Cloud Environment Configuration

The shared cloud infrastructure is configured in your `.env` file:

```env
# Shared Supabase PostgreSQL (with PostGIS)
DB_HOST=aws-0-ap-southeast-2.pooler.supabase.com
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres.kjpjnqqsyimlzerqsrot
DB_PASSWORD=u7r12Zy5LaOlNY9A
DB_SSLMODE=require

# Shared Redis Cloud Instance
REDIS_HOST=superclean-appliance-hyperpolished-40279.db.redis.io
REDIS_PORT=17310
REDIS_USERNAME=default
REDIS_PASSWORD=a5hA4Getu63prRukZvaIvHRMvXJdNAJb
REDIS_SSL=false
```

---

## 5. Feature Status & Contract Checklist

### Member 2 Modules (Platform Track)
* [x] **M2.1 Data Layer**: PostgreSQL + PostGIS live schema on Supabase.
* [x] **M2.2 Event Ingestion**: Redis consumer subscribing to `anpr_events`.
* [x] **M2.3 Trajectory Engine**: Auto-reconstructing multi-camera journeys.
* [x] **M2.4 GIS Visualization**: MapLibre GL map with live status markers and route paths.
* [x] **M2.5 Origin-Destination Engine**: Aggregation of trip counts across camera pairs.
* [x] **M2.6 Congestion Analytics**: 15-minute historical window delay calculations.
* [x] **M2.7 Congestion Propagation**: Multi-factor cascade delay projections.
* [x] **M2.8 Route Anomaly Detection**: Statistical $2\sigma$ outlier detection.
* [x] **M2.9 Collective Movement Anomalies**: Unusual surge and convoy identification.
* [x] **M2.10 Camera Health Monitoring**: Live status tracking and heartbeat audit.
* [ ] **M2.11 Dynamic Rerouting**: Precalculated shortest paths available; live congestion-weighted rerouting pending.
* [x] **M2.12 Authority Recommendation**: GIS-based administrative zone alert mapping.
* [ ] **M2.13 SUMO Simulation**: Scenario replay pending.
* [x] **M2.14 Real-time WebSockets**: Multi-channel event stream (Trajectories, Alerts, Camera Health, Congestion) to `/ws/traffic`.
* [x] **M2.15 Backend APIs**: Complete FastAPI suite with Swagger docs at `/docs`.
* [x] **M2.16 Dashboard**: Complete React command center with live map markers, KPI updates, and incident streaming.

### Member 1 Modules (CV / ML / NLP Track)
* [ ] **M1.1 - M1.5 Video / YOLO / OCR**: Vehicle detection, plate cropping, PaddleOCR.
* [ ] **M1.6 Cross-Camera Matching**: Vehicle matching across camera nodes.
* [ ] **M1.7 Congestion Prediction**: LightGBM/XGBoost model using backend window features.
* [ ] **M1.8 NLP Query Engine**: Natural language translation to API calls.
* [ ] **M1.9 - M1.10 Walkthrough & Explanation Assistant**: Natural language insights.

---

## 6. Immediate Verification Checklist for Member 1

1. Start backend workers (with autonomous live streamer):
   ```powershell
   .\venv\Scripts\Activate.ps1
   python start_system.py --demo
   ```
2. Start the Command Center frontend in a second terminal:
   ```powershell
   cd frontend-1
   npm install
   npm run dev
   ```
3. Test event ingestion:
   ```powershell
   python redis_producer.py
   ```
4. Verify backend response:
   ```powershell
   Invoke-RestMethod http://127.0.0.1:8000/cameras
   Invoke-RestMethod http://127.0.0.1:8000/cameras/health
   Invoke-RestMethod http://127.0.0.1:8000/analytics/summary
   Invoke-RestMethod http://127.0.0.1:8000/system/health
   ```
5. Open `http://localhost:5173` to see live markers, streaming trajectories, and interactive incident dispatching.
6. (Optional) Run fast-paced demo simulation (2.5x speed):
   ```powershell
   python demo_streamer.py --speed 2.5
   ```
