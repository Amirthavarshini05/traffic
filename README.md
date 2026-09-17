# 🚦 City-Wide Vehicle Intelligence & Traffic Analytics Platform (NeuralGrid)

A distributed, city-scale intelligent transportation and surveillance platform designed to transform real-time ANPR (Automatic Number Plate Recognition) camera observations into high-level urban traffic intelligence. 

The platform supports automated cross-camera trajectory reconstruction, dynamic congestion analysis, cascade delay propagation modeling, statistical route anomaly detection, real-time vehicle watchlist surveillance, and automated incident management over interactive GIS command center dashboards.

---

## 🏛️ System Architecture & Workflow

The platform decouples the sensing/perception layer from the central analytical engine using an event-driven stream architecture:

```text
[DISTRIBUTED CAMERAS / ANPR SENSING LAYER]
  │  (Live Edge CCTV or Scenario Simulation Streamer)
  ▼ (Normalized Event JSON)
[REDIS STREAM: anpr_events]
  │
  ▼
[EVENT INGESTION ENGINE] ────► [PostgreSQL + PostGIS Database]
  │                                    │
  ├────────────────────────────────────┤
  ▼                                    ▼
[TRAJECTORY RECONSTRUCTION] ◄── [OSM Camera Road Topology]
  │                                    │
  ▼ (PostgreSQL NOTIFY Triggers)       ▼
[REDIS STREAM: trajectory_events]   [REDIS STREAM: alert_events]
  │                                    │
  ├────────────────────────────────────┴─────────────────────────────┐
  ▼                                                                  ▼
[ANALYTICAL WORKERS]                                        [REALTIME PUSH SERVER]
 • Route Anomaly Worker (2σ outliers)                        • FastAPI WebSocket (/ws/traffic)
 • Camera Health Monitor (Heartbeat audits)                         │
 • Congestion & Delay Engine                                        ▼
 • Propagation Engine (Cascade delay modeling)              [REACT + MAPLIBRE COMMAND CENTER]
 • Authority Assignation (GIS boundaries)                    • Live GIS Map Monitoring
 • Watchlist Surveillance Interceptor                        • Historical Trends & Baseline Comparisons
                                                             • Vehicle Dossier & Journey Reconstruction
                                                             • Incident Command & Dispatch
                                                             • System Telemetry & Observability
```

### Core Workflow
1. **Edge Perception**: Cameras and computer vision pipelines detect vehicles, extract license plates, and publish normalized observation events to the Redis event bus (`anpr_events`).
2. **Ingestion & Auto-Registration**: Background consumers validate payloads, auto-register new vehicles, and persist timestamped spatial points (`Point, 4326`) into PostgreSQL.
3. **Trajectory Reconstruction**: When a vehicle is identified across multiple observation points, the trajectory engine determines sequential transitions, looks up road geometry from OpenStreetMap, computes travel duration and speed, and links trajectory segments into continuous journeys.
4. **Watchlist Surveillance**: Incoming observations are verified in real time against active `vehicle_watchlist` hotlist records. Matching targets immediately generate `WATCHLIST_HIT` alerts.
5. **Real-time Event Dissemination**: Asynchronous database triggers (`trigger_trajectory_created`, `trigger_alert_created`) notify the event publisher, which broadcasts newly minted trajectories and incidents into Redis streams.
6. **Continuous Analytics**: Parallel worker processes continuously evaluate traffic state:
   - Comparing link travel times against historical moving baselines.
   - Projecting downstream delay cascades through road network topology.
   - Detecting statistical travel-time deviations ($2\sigma$ outliers).
   - Auditing camera transmission heartbeats and reporting network health (`HEALTHY`, `WARNING`, `OFFLINE`).
7. **Command Dashboard**: A responsive web dashboard renders live GIS maps, road route geometries, camera status indicators, and time-series traffic charts.

---

## 🚀 Key Implemented Features

### 1. GIS & Trajectory Reconstruction Engine
* **Automated Journey Stitching**: Associates independent camera detections of the same vehicle into continuous multi-segment trajectories.
* **Road Topology Matching**: Uses OpenStreetMap (OSM) graph definitions to map camera-to-camera journeys onto actual physical roads and distances.
* **Observation Gap Detection**: Explicitly identifies unmonitored camera gaps along a route without interpolating misleading fake paths.
* **Origin-Destination (OD) Matrix**: Aggregates vehicle journeys into city-wide trip flow matrices for urban planning.

### 2. Congestion & Propagation Analytics
* **Historical Baseline Comparison**: Evaluates 15-minute tumbling windows to calculate real-time delay percentages relative to historical free-flow speeds. Supports baseline comparisons against `same_time_yesterday`, `same_time_last_week`, and `previous_period`.
* **Multi-Factor Propagation Modeling**: Projects how congestion cascades through connected downstream road links using a 4-component weighted model: source delay, turning probability, continuation rate, and downstream bottleneck severity.

### 3. Anomaly & Incident Detection
* **Statistical Route Anomaly Detection**: Employs dynamic sample-based statistical bounds ($\mu \pm 2\sigma$) to flag abnormal vehicle delays, unauthorized stops, or route deviations.
* **Collective Movement Detection**: Flags multi-vehicle convoy or surge anomalies by detecting unusual deviations from historical flow distributions.
* **Camera Health & Network Monitoring**: Calculates real-time time-to-last-event intervals for every camera, automatically classifying nodes as `HEALTHY`, `WARNING`, or `OFFLINE`.
* **Spatial Authority Assignation**: Automatically correlates incident coordinates with administrative zone boundaries (`ST_Within`) to assign responsible traffic police divisions.
* **Vehicle Watchlist / Hotlist**: Real-time interception of flagged plates with priority levels (`CRITICAL`, `HIGH`, `MEDIUM`), case reference tagging, and RBAC plate masking for privacy compliance.

### 4. Scenario-Driven Live Simulation Streamer
* **Continuous 25-Minute Looping**: Simulates realistic city traffic across 5 corridors, automatically looping for continuous demonstrations.
* **5 Scripted Demo Storylines**:
  - *Story 1: Normal City Flow* (All cameras healthy green, live trajectory stitching).
  - *Story 2: Watchlist Intrusion* (Critical stolen vehicle alert immediately popping up on map).
  - *Story 3: Route Travel-Time Anomaly* (Breakdown/detour flagged by $2\sigma$ worker).
  - *Story 4: Camera Heartbeat Drop & Recovery* (Camera status transition Healthy $\to$ Warning $\to$ Offline and auto-recovery).
  - *Story 5: Congestion Surge & Cascade Delay Propagation* (Traffic jam with downstream spillover).
  - *Story 6: Coordinated Convoy Detection* (3+ vehicles traveling closely in tight formation).
* **Speed Multipliers**: Run at real-time (`--speed 1`), 2x (`--speed 2`), or 3x (`--speed 3`) speed.
* **Interactive CLI Hotkeys**: Inject any incident on demand during a live presentation.

---

## 📂 Repository Structure

```text
.
├── .env                                # Local environment secrets (ignored by Git)
├── .env.example                        # Template for environment configuration
├── .gitignore                          # Standard ignore rules
├── README.md                           # System architecture & feature guide
├── HANDOFF.md                          # Team integration handoff & data contract
├── SYSTEM_ARCHITECTURE_AND_FEATURES.md # Complete feature & frontend guide
├── walkthrough.md                      # Technical verification & implementation walkthrough
├── requirements.txt                    # Project dependencies
├── schema.sql                          # Database schema, PostGIS extensions & triggers
├── start_system.py                     # Multi-process orchestrator for all services
│
├── app/                                # FastAPI Backend Application
│   ├── advanced_routes.py              # Telemetry, watchlist, vehicle search, baselines, exports
│   ├── audit_service.py                # Security audit logging & RBAC plate masking
│   ├── database.py                     # PostgreSQL connection pool & Redis client factories
│   ├── main.py                         # REST API endpoints & route controllers
│   ├── realtime.py                     # WebSocket ConnectionManager & Redis stream consumer
│   ├── schemas.py                      # Pydantic data schemas & response models
│   └── time_utils.py                   # Defensive ISO-8601 parsing & historical baseline windows
│
├── frontend-1/                         # React + TypeScript + Tailwind + MapLibre Command Center
│   ├── index.html                      # Single-page application entrypoint
│   ├── package.json                    # Frontend dependencies & scripts
│   ├── vite.config.ts                  # Vite bundler configuration
│   └── src/
│       ├── App.tsx                     # Main application layout & page switcher
│       ├── components/                 # UI components, MapLibre canvas, Floating Q&A Assistant
│       ├── context/                    # AppData, Selection, TimeRange, and Map contexts
│       └── pages/                      # 7 Dedicated Command Center Pages:
│           ├── CommandCenter.tsx       # Live GIS surveillance map, corridors, active incidents
│           ├── TrafficAnalytics.tsx    # Diurnal flow curves, congestion trends, zone density
│           ├── VehicleInvestigation.tsx# Dossier search, trajectory playback, observation gaps
│           ├── RouteOD.tsx             # Historical comparison widget & OD trip matrix
│           ├── Alerts.tsx              # Incident command center with division filtering
│           ├── SystemHealth.tsx        # PostgreSQL/Redis telemetry & camera freshness audit
│           └── Settings.tsx            # System thresholds & map configurations
│
├── tests/                              # Automated Unit & Integration Test Suite
│   ├── test_time_utils.py              # Defensive timestamp & baseline window test cases
│   └── test_advanced_endpoints.py      # End-to-end API, RBAC masking, watchlist tests
│
├── check/                              # GIS Road Network & Topology Utilities
│   ├── chennai_drive.graphml           # OpenStreetMap road graph
│   ├── check_all_camera_routes.py      # Camera-to-camera connectivity checker
│   ├── generate_camera_routes.py       # Computes shortest paths between camera pairs
│   └── all_camera_routes_osm.geojson   # Exported GeoJSON route paths
│
├── demo_streamer.py                    # Autonomous 25-min scenario-driven ANPR simulation engine
├── seed_historical_intelligence.py     # Batch generator for 14-day historical baseline data
├── event_ingestion.py                  # Parses normalized ANPR JSON into PostgreSQL
├── redis_producer.py                   # Client utility to publish events to Redis stream
├── redis_consumer.py                   # Worker: ingests ANPR events, stitches journeys, flags watchlist
├── trajectory_engine.py                # Reconstructs trajectories from consecutive events
├── trajectory_event_publisher.py       # Publishes DB trajectory & alert notifications to Redis
├── route_anomaly_worker.py             # Background anomaly detector (2σ travel-time deviations)
├── camera_health_worker.py             # Background camera uptime and latency monitor
├── collective_movement_engine.py       # Evaluates group movement surge anomalies
├── congestion_engine.py                # Aggregates historical congestion in 15-minute windows
├── congestion_propagation_engine.py    # Predicts cascade delays across connected road links
└── authority_assignment_engine.py      # Assigns alerts to city zones and traffic authorities
```

---

## 🛠️ Setup & Startup Guide

### Prerequisites
* Python 3.11+
* Node.js 18+ and npm
* PostgreSQL (with PostGIS extension)
* Redis 7+

### 1. Environment Configuration
Create a `.env` file in the project root:
```env
# PostgreSQL Configuration
DB_HOST=aws-0-ap-southeast-2.pooler.supabase.com
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres.your_user
DB_PASSWORD=your_password
DB_SSLMODE=require

# Redis Configuration
REDIS_HOST=your-redis-host.redis.io
REDIS_PORT=17310
REDIS_USERNAME=default
REDIS_PASSWORD=your_redis_password
REDIS_SSL=false
```

### 2. Python Virtual Environment & Dependencies
```powershell
# Create and activate virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt
```

### 3. Seed High-Density Historical Intelligence
Generate 14 days of realistic historical baseline data anchored to current time:
```powershell
python seed_historical_intelligence.py
```
This populates 11,000+ ANPR events, 17,000+ trajectories, 5,000+ OD trips, 4,300+ 15-minute historical congestion windows, watchlist targets, and multi-division alerts.

### 4. Launch Backend Services & Live Simulation
```powershell
# Start all 6 backend services PLUS the autonomous live simulation streamer:
python start_system.py --demo
```
This launches:
* **FastAPI Server**: `http://127.0.0.1:8000` (Swagger docs at `/docs`)
* **Redis Consumer**: Ingests ANPR events, auto-reconstructs trajectories, checks watchlist
* **Trajectory Publisher**: Forwards newly created journeys & alerts to Redis
* **Route Anomaly Worker**: Flags statistical travel-time outliers
* **Camera Health Worker**: Continuously audits camera heartbeats
* **Analytics Worker**: Recomputes historical congestion & propagation metrics
* **Live Simulation Streamer**: Continuously generates live ANPR traffic with demo scenarios

### 5. Launch Command Center Frontend
In a separate terminal:
```powershell
cd frontend-1
npm install
npm run dev
```
Open **`http://localhost:5173`** in your browser.

---

## 🎮 Interactive Live Demo Controls

While `demo_streamer.py` is running, you can press any of the following keys in its terminal and hit **Enter** to trigger scenarios on demand:

| Hotkey | Scenario Triggered | Observed Dashboard Behavior |
| :---: | :--- | :--- |
| <kbd>w</kbd> + Enter | **Critical Watchlist Hit** | Sights stolen luxury SUV `TN09BV1907` at CAM01 $\to$ CAM02. Instantly flashes a **High-Priority Red Alert Banner** on the map & logs incident card. |
| <kbd>a</kbd> + Enter | **Route Travel-Time Anomaly** | Sights vehicle `TN07CD4567` with an extreme travel delay ($+3.2\sigma$ above mean). Flags a **`ROUTE_ANOMALY`** alert assigned to Guindy Division. |
| <kbd>c</kbd> + Enter | **Camera Dropout / Recovery** | Toggles CAM04 (Taramani Tech Park). First press drops the feed (**Green $\to$ Yellow $\to$ Red Offline**); second press restores it back to **Healthy (Green)**. |
| <kbd>j</kbd> + Enter | **Congestion Jam Surge** | Injects 8 vehicles in rapid succession along Anna Salai corridor, spiking delay percentage and triggering cascade delay propagation. |
| <kbd>k</kbd> + Enter | **Coordinated Convoy** | Injects 3 vehicles (`TN02XY1111`, `2222`, `3333`) traveling in tight 3-second spacing, triggering a **`COLLECTIVE_MOVEMENT`** alert. |
| <kbd>h</kbd> + Enter | **Help Menu** | Displays all available keyboard hotkeys. |
| <kbd>q</kbd> + Enter | **Quit** | Cleanly shuts down the streamer. |

---

## 🧪 Running Automated Tests

Run the complete backend test suite:
```powershell
python -m unittest discover -s tests -p "test_*.py"
```

Verify frontend production build:
```powershell
cd frontend-1
npm run build
```
