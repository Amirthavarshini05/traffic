# Walkthrough: Realistic Demo Data & 20–30 Minute Continuous Simulation Engine

This walkthrough documents the implementation and verification of the high-density historical baseline dataset and the autonomous 20–30 minute scenario-driven simulation engine for the **City-Wide Vehicle Intelligence Platform (NeuralGrid)**.

---

## 1. High-Density Historical Baseline Seeding ([`seed_historical_intelligence.py`](file:///c:/Users/dilip/Desktop/SIH%20-%20127/seed_historical_intelligence.py))

The database was populated with authentic, time-relative multi-day historical traffic data dynamically anchored to `CURRENT_TIMESTAMP`:

* **14-Day Diurnal Flow Distribution**:
  * Morning Peak (08:00 – 10:30 AM): Heavy volume, higher travel times on inbound arterial corridors.
  * Midday Flow (11:00 AM – 04:30 PM): Steady moderate traffic.
  * Evening Peak (05:00 – 08:30 PM): Severe congestion along OMR IT Corridor and Guindy arterial links.
  * Night / Off-Peak (09:00 PM – 06:00 AM): High velocity, free-flow conditions.
* **Database Telemetry Verified in PostgreSQL**:
  * **Events**: 11,391 spatial ANPR observation points tagged with GPS coordinates across Chennai.
  * **Trajectories**: 17,791 multi-camera journey hops matching OpenStreetMap road networks.
  * **Trips**: 5,086 completed origin-destination trips powering the OD matrix and commuter flow charts.
  * **Historical Congestion**: 4,323 tumbling 15-minute intervals spanning the last 14 days, enabling comparisons against Yesterday, Last Week, and Previous Periods on [`RouteOD.tsx`](file:///c:/Users/dilip/Desktop/SIH%20-%20127/frontend-1/src/pages/RouteOD.tsx) and trend lines on [`TrafficAnalytics.tsx`](file:///c:/Users/dilip/Desktop/SIH%20-%20127/frontend-1/src/pages/TrafficAnalytics.tsx).
  * **Vehicles**: 408 realistic vehicles across Tamil Nadu RTOs (`TN01`, `TN02`, `TN07`, `TN09`, `TN10`, `TN14`, `TN22`).
  * **Watchlist**: 6 active targets including high-priority stolen luxury SUV `TN09BV1907` (Armed Robbery Case #FIR-2026-4491) and hit-and-run suspect `TN01AB1234`.
  * **Alerts**: 71 multi-category incidents across 5 police divisions (`Anna Salai Traffic Wing`, `Guindy Division`, `East Coast Traffic Authority`, `South Chennai Traffic Division`, `South Traffic Headquarters`).
  * **Camera Freshness**: All 10 cameras primed with observations within the last 10 minutes so initial operational status reports `HEALTHY` (Green).

---

## 2. Ingestion Pipeline & Watchlist Surveillance Wiring ([`redis_consumer.py`](file:///c:/Users/dilip/Desktop/SIH%20-%20127/redis_consumer.py))

* **Auto-Trajectory Reconstruction**: When an ANPR event is received via Redis stream `anpr_events`, `redis_consumer.py` automatically passes the observation to `create_trajectory()`, persisting new journey hops and firing PostgreSQL notification trigger `trigger_trajectory_created`.
* **Real-Time Watchlist Interception**: Each incoming plate is checked against active `vehicle_watchlist` records. On match, it writes a `WATCHLIST_HIT` alert to PostgreSQL, firing `trigger_alert_created`, broadcasting immediately over WebSockets to `/ws/traffic`.

---

## 3. Autonomous 20–30 Minute Simulation Engine ([`demo_streamer.py`](file:///c:/Users/dilip/Desktop/SIH%20-%20127/demo_streamer.py))

A scenario-driven ANPR generator that continuously pushes normalized observations into Redis stream `anpr_events`:

### Key Features:
1. **Continuous Commuter Fleet**: 8 background vehicles continually cycle across 5 primary Chennai highway corridors, emitting sightings every 15–30s.
2. **5 Scripted Demo Storylines**:
   * **Storyline 1 (Min 0:00 - 3:30)**: Baseline City Flow (All 10 cameras healthy green, live movement card pulsing with updates).
   * **Storyline 2 (Min 3:30 - 6:00)**: Watchlist Intrusion (`TN09BV1907` sighted at CAM01 $\to$ CAM02, triggering instant high-priority red alert).
   * **Storyline 3 (Min 7:00 - 10:30)**: Route Anomaly (`TN07CD4567` delayed $+3.2\sigma$ above mean, flagged by anomaly detector).
   * **Storyline 4 (Min 11:00 - 15:00)**: Camera Heartbeat Drop & Recovery (CAM04 drops $\to$ turns Yellow/Red $\to$ auto-recovers to Green).
   * **Storyline 5 (Min 16:30 - 19:30)**: Traffic Surge & Delay Cascade (High-volume burst triggers downstream propagation).
   * **Storyline 6 (Min 20:00 - 24:00)**: Coordinated Convoy (3 vehicles traveling $<3$s headway trigger convoy alert).
   * **Min 25:00**: Smooth recursive wrap-around for continuous execution.
3. **Speed Multipliers**: Supports `--speed 1.0` (real-time 25 min), `--speed 2.0` (12.5 min), or `--speed 3.0` (8 min) for rapid judging sessions.
4. **Interactive CLI Hotkeys**:
   * `w` + Enter : Instantly inject Watchlist Hit (`TN09BV1907`)
   * `a` + Enter : Instantly inject Route Anomaly
   * `c` + Enter : Toggle CAM04 Dropout / Recovery
   * `j` + Enter : Inject Traffic Surge / Jam
   * `k` + Enter : Inject Coordinated Convoy
   * `q` + Enter : Stop streamer

---

## 4. How to Trigger & Run the Live Demo

### Option A: Complete System with Simulation Streamer
```powershell
# Launch all 6 backend services PLUS the live streamer in one command:
python start_system.py --demo
```

### Option B: Standalone Streamer (with Speed & Hotkey Control)
```powershell
# In a dedicated terminal, launch the streamer at real-time speed:
python demo_streamer.py

# Or launch in fast-paced 2.5x demo mode:
python demo_streamer.py --speed 2.5
```

### Option C: Launch Frontend Dashboard
```powershell
cd frontend-1
npm run dev
# Open http://localhost:5173
```

---

## 5. Automated Verification Results

* **Backend Test Suite**: All 23 tests passed in 52.4s:
  ```text
  .......................
  ----------------------------------------------------------------------
  Ran 23 tests in 52.422s
  OK
  ```
* **Frontend Production Build**: Cleanly compiled with 0 errors:
  ```text
  ✓ 2192 modules transformed.
  dist/assets/index-yEDFWoiE.js   1,725.03 kB
  ✓ built in 21.68s (0 errors)
  ```
* **Real-time Pipeline Verified**: Redis stream publishing, watchlist matching, and WebSocket event broadcasts tested and operational.
