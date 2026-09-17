"""
High-Performance Batch Historical Intelligence Seeder
Generates authentic, time-relative historical traffic data dynamically anchored
to datetime.now(timezone.utc) covering the past 14 days.
Uses psycopg2.extras.execute_values for blazing-fast multi-row batch insertion.
"""

import json
import math
import random
import sys
from datetime import datetime, timedelta, timezone
from psycopg2.extras import execute_values
from app.database import get_connection

# ====================================================================
# Configuration & Definitions
# ====================================================================

CAMERAS = {
    "CAM01": {"name": "Kathipara Junction ANPR", "lon": 80.2045, "lat": 13.0068, "zone_id": 33},
    "CAM02": {"name": "Gemini Flyover ANPR", "lon": 80.2505, "lat": 13.0528, "zone_id": 31},
    "CAM03": {"name": "Madhya Kailash Junction ANPR", "lon": 80.2462, "lat": 13.0066, "zone_id": 30},
    "CAM04": {"name": "Taramani Tech Park ANPR", "lon": 80.2510, "lat": 12.9759, "zone_id": 30},
    "CAM05": {"name": "Koyambedu CMBT Junction ANPR", "lon": 80.1980, "lat": 13.0694, "zone_id": 31},
    "CAM06": {"name": "Velachery Checkpost ANPR", "lon": 80.2220, "lat": 12.9750, "zone_id": 32},
    "CAM07": {"name": "Sholinganallur Junction ANPR", "lon": 80.2495, "lat": 12.9400, "zone_id": 30},
    "CAM08": {"name": "Chennai Airport Terminal ANPR", "lon": 80.1700, "lat": 12.9800, "zone_id": 33},
    "CAM09": {"name": "Chennai Central Station ANPR", "lon": 80.2750, "lat": 13.0820, "zone_id": 31},
    "CAM10": {"name": "T. Nagar Panagal Park ANPR", "lon": 80.2300, "lat": 13.0400, "zone_id": 29},
}

CORRIDORS = [
    ["CAM08", "CAM01", "CAM10", "CAM02", "CAM09"],
    ["CAM08", "CAM01", "CAM06", "CAM04", "CAM07"],
    ["CAM09", "CAM02", "CAM03", "CAM04", "CAM07"],
    ["CAM05", "CAM10", "CAM01", "CAM06"],
    ["CAM07", "CAM04", "CAM03", "CAM02", "CAM09"],
    ["CAM09", "CAM02", "CAM10", "CAM01", "CAM08"]
]

VEHICLE_TYPES = ["Car", "Bus", "Truck", "Motorcycle", "Auto"]
TYPE_WEIGHTS = [0.55, 0.12, 0.08, 0.15, 0.10]

MAKES_MODELS = {
    "Car": [("Maruti Suzuki", "Swift"), ("Hyundai", "Creta"), ("Honda", "City"), ("Toyota", "Innova"), ("Tata", "Nexon"), ("Kia", "Seltos")],
    "Bus": [("MTC Chennai", "Deluxe Bus"), ("Ashok Leyland", "Viking Express"), ("Tata", "Starbus")],
    "Truck": [("Eicher", "Pro 2049"), ("Tata", "407 Gold"), ("BharatBenz", "1217C")],
    "Motorcycle": [("Royal Enfield", "Classic 350"), ("TVS", "Apache RTR"), ("Yamaha", "FZ-S"), ("Hero", "Splendor Plus")],
    "Auto": [("Bajaj", "RE Compact"), ("Piaggio", "Ape City"), ("TVS", "King Duramax")]
}

COLORS = ["White", "Silver", "Grey", "Black", "Red", "Blue", "Golden"]

ROUTE_STATS = [
    ("CAM01", "CAM02", 420.0, 55.0),
    ("CAM02", "CAM01", 440.0, 60.0),
    ("CAM08", "CAM01", 360.0, 45.0),
    ("CAM01", "CAM08", 380.0, 50.0),
    ("CAM10", "CAM02", 240.0, 35.0),
    ("CAM02", "CAM10", 250.0, 35.0),
    ("CAM01", "CAM10", 310.0, 40.0),
    ("CAM10", "CAM01", 320.0, 45.0),
    ("CAM02", "CAM09", 480.0, 65.0),
    ("CAM09", "CAM02", 500.0, 70.0),
    ("CAM03", "CAM04", 300.0, 40.0),
    ("CAM04", "CAM03", 310.0, 45.0),
    ("CAM04", "CAM07", 480.0, 60.0),
    ("CAM07", "CAM04", 510.0, 65.0),
    ("CAM02", "CAM03", 330.0, 45.0),
    ("CAM03", "CAM02", 340.0, 45.0),
    ("CAM01", "CAM06", 380.0, 50.0),
    ("CAM06", "CAM01", 390.0, 50.0),
    ("CAM06", "CAM04", 310.0, 40.0),
    ("CAM04", "CAM06", 320.0, 40.0),
    ("CAM05", "CAM10", 450.0, 60.0),
    ("CAM10", "CAM05", 470.0, 65.0),
    ("CAM05", "CAM09", 540.0, 75.0),
    ("CAM09", "CAM05", 560.0, 80.0),
]


def get_hourly_multiplier(hour: int) -> float:
    """Simulates realistic Chennai diurnal traffic volume curve."""
    if 8 <= hour <= 10:      # Morning rush hour
        return 1.95
    elif 11 <= hour <= 16:   # Midday steady traffic
        return 1.15
    elif 17 <= hour <= 20:   # Evening heavy rush hour
        return 2.25
    elif 21 <= hour <= 23:   # Evening decline
        return 0.75
    else:                    # Night / early morning
        return 0.25


def seed_database():
    print("=" * 70, flush=True)
    print("SEEDING HIGH-DENSITY HISTORICAL TRAFFIC INTELLIGENCE", flush=True)
    print(f"Execution Reference Time (NOW): {datetime.now(timezone.utc).isoformat()}", flush=True)
    print("=" * 70, flush=True)

    conn = get_connection()
    cur = conn.cursor()

    now = datetime.now(timezone.utc)

    # ---------------------------------------------------------
    # 1. Clean previous transient test data (keep structure)
    # ---------------------------------------------------------
    print("\n1. Cleaning previous transient test data...", flush=True)
    cur.execute("DELETE FROM alerts WHERE detected_at < %s - INTERVAL '14 days';", (now,))
    cur.execute("DELETE FROM congestion_propagation;")
    cur.execute("DELETE FROM historical_congestion WHERE time_window_start < %s - INTERVAL '14 days';", (now,))
    conn.commit()

    # ---------------------------------------------------------
    # 2. Seed Route Travel Statistics
    # ---------------------------------------------------------
    print("\n2. Establishing calibrated Route Travel Statistics (Mean & StdDev)...", flush=True)
    stats_tuples = [
        (start_cam, end_cam, avg_sec, std_sec, random.randint(180, 450))
        for start_cam, end_cam, avg_sec, std_sec in ROUTE_STATS
    ]
    execute_values(cur, """
        INSERT INTO route_travel_stats (
            starting_camera_id, ending_camera_id, average_travel_seconds,
            stddev_travel_seconds, sample_count
        ) VALUES %s
        ON CONFLICT DO NOTHING;
    """, stats_tuples)
    conn.commit()
    print(f" -> {len(ROUTE_STATS)} route travel baselines established.", flush=True)

    # ---------------------------------------------------------
    # 3. Seed Watchlist Targets
    # ---------------------------------------------------------
    print("\n3. Seeding Vehicle Watchlist Targets...", flush=True)
    watchlist_targets = [
        ("TN09BV1907", "active", "CRITICAL", "Armed Robbery Getaway / Stolen Luxury SUV", "FIR-2026-4491"),
        ("TN01AB1234", "active", "HIGH", "Fatal Hit-and-Run Incident on Guindy Corridor", "HNR-2026-0812"),
        ("TN07CD4567", "active", "MEDIUM", "Reconnaissance / Suspicious Highway Detours", "BOLO-2026-1190"),
        ("TN22EF9012", "active", "HIGH", "Unregistered Commercial Transit / Smuggling Suspect", "CUS-2026-0341"),
        ("TN10ZZ9999", "inactive", "MEDIUM", "Expired Permit (Resolved)", "TRF-2026-0012")
    ]
    for plate, status, priority, reason, case_ref in watchlist_targets:
        cur.execute("""
            INSERT INTO vehicle_watchlist (
                plate_number, status, priority, reason, case_reference, created_by, created_at
            ) VALUES (%s, %s, %s, %s, %s, 'Chief Inspector', %s - INTERVAL '3 days')
            ON CONFLICT (plate_number) DO UPDATE SET
                status = EXCLUDED.status,
                priority = EXCLUDED.priority,
                reason = EXCLUDED.reason,
                case_reference = EXCLUDED.case_reference;
        """, (plate, status, priority, reason, case_ref, now))
    conn.commit()
    print(f" -> {len(watchlist_targets)} watchlist profiles registered.", flush=True)

    # ---------------------------------------------------------
    # 4. Generate Vehicles Fleet (150+ realistic vehicles)
    # ---------------------------------------------------------
    print("\n4. Generating diverse vehicle fleet...", flush=True)
    rto_districts = ["01", "02", "03", "04", "05", "07", "09", "10", "14", "18", "22"]
    series = ["AA", "AB", "BA", "BB", "CA", "CB", "DA", "DB", "EA", "FA", "GA", "HA"]
    
    fleet = [
        {"plate": "TN09BV1907", "type": "Car", "make": "Toyota", "model": "Fortuner", "color": "Black"},
        {"plate": "TN01AB1234", "type": "Car", "make": "Hyundai", "model": "Creta", "color": "White"},
        {"plate": "TN07CD4567", "type": "Car", "make": "Honda", "model": "City", "color": "Silver"}
    ]

    for i in range(120):
        rto = random.choice(rto_districts)
        ser = random.choice(series)
        num = f"{random.randint(1000, 9999)}"
        plate = f"TN{rto}{ser}{num}"
        vtype = random.choices(VEHICLE_TYPES, weights=TYPE_WEIGHTS)[0]
        make, model = random.choice(MAKES_MODELS[vtype])
        color = random.choice(COLORS)
        fleet.append({"plate": plate, "type": vtype, "make": make, "model": model, "color": color})

    vehicle_tuples = [(v["plate"],) for v in fleet]
    execute_values(cur, """
        INSERT INTO vehicles (plate_number) VALUES %s
        ON CONFLICT (plate_number) DO NOTHING;
    """, vehicle_tuples)
    conn.commit()

    # Load vehicle_id mapping
    cur.execute("SELECT plate_number, vehicle_id FROM vehicles;")
    vehicle_id_map = {row[0]: row[1] for row in cur.fetchall()}
    print(f" -> {len(vehicle_id_map)} vehicles active in database.", flush=True)

    # ---------------------------------------------------------
    # 5. Synthesize 14-Day Trajectories, Events & Trips (Batched)
    # ---------------------------------------------------------
    print("\n5. Synthesizing 14-day historical trajectories and observations...", flush=True)

    events_to_insert = []
    trajectories_to_insert = []
    trips_to_insert = []

    # Loop over the past 14 days
    for day_offset in range(13, -1, -1):
        day_date = (now - timedelta(days=day_offset)).replace(hour=0, minute=0, second=0, microsecond=0)
        sample_hours = [8, 9, 10, 12, 14, 15, 17, 18, 19, 20]
        if day_offset == 0:
            sample_hours = [h for h in sample_hours if h <= now.hour]

        for hr in sample_hours:
            multiplier = get_hourly_multiplier(hr)
            num_journeys = int(5 * multiplier)

            for _ in range(num_journeys):
                vehicle = random.choice(fleet)
                v_id = vehicle_id_map.get(vehicle["plate"])
                if not v_id:
                    continue
                corridor = random.choice(CORRIDORS)

                trip_start_minute = random.randint(0, 50)
                current_time = day_date + timedelta(hours=hr, minutes=trip_start_minute, seconds=random.randint(0, 59))
                if current_time >= now - timedelta(minutes=2):
                    continue

                prev_cam_id = None
                trip_start_cam = corridor[0]
                trip_start_time = current_time
                trip_total_dist = 0.0
                trip_total_sec = 0.0

                for step_idx, cam_id in enumerate(corridor):
                    cam_info = CAMERAS[cam_id]
                    confidence = round(random.uniform(94.0, 99.5), 2)
                    heading = round(random.uniform(10.0, 350.0), 1)

                    # Event tuple: (vehicle_id, camera_id, plate_number, vehicle_type, make, model, color, observed_at, confidence, heading, lon, lat, raw_data, created_at)
                    events_to_insert.append((
                        v_id, cam_id, vehicle["plate"], vehicle["type"],
                        vehicle["make"], vehicle["model"], vehicle["color"],
                        current_time, confidence, heading,
                        cam_info["lon"], cam_info["lat"],
                        json.dumps({"source": "historical_seed", "camera": cam_id}),
                        current_time
                    ))

                    if prev_cam_id is not None:
                        stat_match = next((s for s in ROUTE_STATS if s[0] == prev_cam_id and s[1] == cam_id), None)
                        base_sec, std_sec = (stat_match[2], stat_match[3]) if stat_match else (350.0, 45.0)

                        travel_seconds = round(base_sec * (1.0 + (multiplier - 1.0) * 0.35) + random.gauss(0, std_sec * 0.5), 1)
                        travel_seconds = max(90.0, travel_seconds)
                        distance_m = round(travel_seconds * random.uniform(11.0, 15.0), 1)

                        trip_total_sec += travel_seconds
                        trip_total_dist += distance_m
                        hop_start_time = current_time - timedelta(seconds=travel_seconds)

                        trajectories_to_insert.append((
                            v_id, prev_cam_id, cam_id,
                            hop_start_time, current_time,
                            travel_seconds, distance_m,
                            'OSM_MATCHED', round(random.uniform(0.92, 0.99), 2), current_time
                        ))

                    prev_cam_id = cam_id
                    current_time += timedelta(seconds=random.randint(180, 420))

                if prev_cam_id is not None and len(corridor) >= 2:
                    trips_to_insert.append((
                        v_id, trip_start_cam, corridor[-1],
                        trip_start_time, current_time,
                        trip_total_sec, trip_total_dist, current_time
                    ))

    print(f" -> Inserting {len(events_to_insert)} events in batches...", flush=True)
    # Batch insert events
    BATCH_SIZE = 1000
    for i in range(0, len(events_to_insert), BATCH_SIZE):
        batch = events_to_insert[i:i + BATCH_SIZE]
        execute_values(cur, """
            INSERT INTO events (
                vehicle_id, camera_id, plate_number, vehicle_type,
                make, model, color, observed_at, confidence, heading,
                location, raw_data, created_at
            ) VALUES %s;
        """, batch, template="(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s)")
        conn.commit()

    print(f" -> Inserting {len(trajectories_to_insert)} trajectories in batches...", flush=True)
    for i in range(0, len(trajectories_to_insert), BATCH_SIZE):
        batch = trajectories_to_insert[i:i + BATCH_SIZE]
        execute_values(cur, """
            INSERT INTO trajectories (
                vehicle_id, from_camera_id, to_camera_id,
                started_at, ended_at, travel_time_seconds, distance_m,
                inference_method, confidence, created_at
            ) VALUES %s;
        """, batch)
        conn.commit()

    print(f" -> Inserting {len(trips_to_insert)} OD trips...", flush=True)
    for i in range(0, len(trips_to_insert), BATCH_SIZE):
        batch = trips_to_insert[i:i + BATCH_SIZE]
        execute_values(cur, """
            INSERT INTO trips (
                vehicle_id, origin_camera_id, destination_camera_id,
                started_at, ended_at, total_travel_time_seconds,
                total_distance_m, created_at
            ) VALUES %s;
        """, batch)
        conn.commit()

    print(f" -> Finished inserting events, trajectories, and OD trips.", flush=True)

    # ---------------------------------------------------------
    # 6. Seed Recent Baseline Observations for Camera Freshness
    # ---------------------------------------------------------
    print("\n6. Guaranteeing fresh observations (< 10 min) for all 10 cameras...", flush=True)
    fresh_events = []
    for cam_id, info in CAMERAS.items():
        v = random.choice(fleet)
        v_id = vehicle_id_map[v["plate"]]
        obs_time = now - timedelta(minutes=random.randint(2, 8), seconds=random.randint(0, 50))
        fresh_events.append((
            v_id, cam_id, v["plate"], v["type"],
            v["make"], v["model"], v["color"],
            obs_time, 98.2, 180.0,
            info["lon"], info["lat"],
            json.dumps({"source": "freshness_heartbeat", "camera": cam_id}),
            obs_time
        ))

    execute_values(cur, """
        INSERT INTO events (
            vehicle_id, camera_id, plate_number, vehicle_type,
            make, model, color, observed_at, confidence, heading,
            location, raw_data, created_at
        ) VALUES %s;
    """, fresh_events, template="(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s)")
    conn.commit()
    print(" -> All 10 cameras primed with live status = HEALTHY.", flush=True)

    # ---------------------------------------------------------
    # 7. Seed 15-Minute Tumbling Historical Congestion Windows
    # ---------------------------------------------------------
    print("\n7. Populating 15-minute historical congestion windows (Past 7 Days)...", flush=True)
    congestion_tuples = []
    tracked_pairs = [
        ("CAM01", "CAM02"),
        ("CAM08", "CAM01"),
        ("CAM03", "CAM04"),
        ("CAM04", "CAM07"),
        ("CAM10", "CAM02"),
        ("CAM05", "CAM09")
    ]

    for days_ago in range(7, -1, -1):
        for hour in range(24):
            if days_ago == 0 and hour > now.hour:
                continue
            multiplier = get_hourly_multiplier(hour)
            for quarter in [0, 15, 30, 45]:
                if days_ago == 0 and hour == now.hour and quarter >= now.minute:
                    continue
                w_start = (now - timedelta(days=days_ago)).replace(hour=hour, minute=quarter, second=0, microsecond=0)
                w_end = w_start + timedelta(minutes=15)

                for from_cam, to_cam in tracked_pairs:
                    stat = next((s for s in ROUTE_STATS if s[0] == from_cam and s[1] == to_cam), None)
                    baseline_sec = stat[2] if stat else 380.0

                    if multiplier > 1.8:
                        delay_pct = round(random.uniform(38.0, 68.0), 1)
                        cong_level = "HIGH" if delay_pct < 55 else "CRITICAL"
                        vehicle_cnt = random.randint(45, 90)
                    elif multiplier > 1.0:
                        delay_pct = round(random.uniform(12.0, 28.0), 1)
                        cong_level = "MODERATE"
                        vehicle_cnt = random.randint(25, 45)
                    else:
                        delay_pct = round(random.uniform(0.0, 8.0), 1)
                        cong_level = "LOW"
                        vehicle_cnt = random.randint(5, 18)

                    avg_travel = round(baseline_sec * (1.0 + delay_pct / 100.0), 1)
                    avg_delay = round(avg_travel - baseline_sec, 1)

                    congestion_tuples.append((
                        from_cam, to_cam, w_start, w_end,
                        vehicle_cnt, baseline_sec,
                        avg_travel, avg_delay,
                        delay_pct, cong_level, w_end
                    ))

    for i in range(0, len(congestion_tuples), BATCH_SIZE):
        batch = congestion_tuples[i:i + BATCH_SIZE]
        execute_values(cur, """
            INSERT INTO historical_congestion (
                from_camera_id, to_camera_id, time_window_start, time_window_end,
                vehicle_count, baseline_travel_time_seconds,
                average_travel_time_seconds, average_delay_seconds,
                average_delay_percent, congestion_level, created_at
            ) VALUES %s;
        """, batch)
        conn.commit()

    print(f" -> Seeded {len(congestion_tuples)} historical congestion records.", flush=True)

    # ---------------------------------------------------------
    # 8. Seed Multi-Division Realistic Alerts
    # ---------------------------------------------------------
    print("\n8. Seeding multi-division realistic incidents...", flush=True)
    alerts_seed = [
        ("CAM02", "ROUTE_ANOMALY", "CRITICAL", "Extreme travel-time outlier (+248s above 2σ bound) on Kathipara -> Gemini corridor. Suspected breakdown or blockage.", now - timedelta(hours=2, minutes=15), "ACTIVE", json.dumps({"plate": "TN09FA1005", "measured_seconds": 668.0, "mean": 420.0, "division": "Anna Salai Traffic Wing"})),
        ("CAM04", "ROUTE_ANOMALY", "HIGH", "Vehicle detour anomaly on OMR corridor. Travel duration exceeded expected historical corridor velocity.", now - timedelta(hours=5, minutes=40), "ACTIVE", json.dumps({"plate": "TN02BA1001", "measured_seconds": 580.0, "mean": 300.0, "division": "East Coast Traffic Authority"})),
        ("CAM01", "ROUTE_ANOMALY", "MEDIUM", "Unexpected slowdown detected near Kathipara cloverleaf junction.", now - timedelta(hours=14), "RESOLVED", json.dumps({"plate": "TN07EA1004", "division": "South Traffic Headquarters"})),
        ("CAM08", "CAMERA_HEALTH", "HIGH", "Delayed packet ingestion on Chennai Airport Terminal ANPR. Heartbeat latency exceeded threshold.", now - timedelta(hours=3, minutes=10), "ACTIVE", json.dumps({"camera_id": "CAM08", "status": "WARNING", "division": "South Traffic Headquarters"})),
        ("CAM06", "CAMERA_HEALTH", "LOW", "Intermittent video stream frame drops during heavy rainfall.", now - timedelta(hours=22), "RESOLVED", json.dumps({"camera_id": "CAM06", "division": "South-East Traffic Division"})),
        ("CAM04", "COLLECTIVE_MOVEMENT", "CRITICAL", "Coordinated Convoy Sighting: 4 vehicles traveling in tight formation (< 3s headway) across consecutive OMR checkpoints.", now - timedelta(hours=1, minutes=20), "ACTIVE", json.dumps({"convoy_size": 4, "corridor": "CAM03_CAM04_CAM07", "division": "East Coast Traffic Authority"})),
        ("CAM02", "COLLECTIVE_MOVEMENT", "HIGH", "Unusual surge anomaly detected: Volume exceeded 185% of normal moving window average.", now - timedelta(hours=7), "RESOLVED", json.dumps({"corridor": "CAM01_CAM02", "division": "Anna Salai Traffic Wing"})),
        ("CAM01", "WATCHLIST_HIT", "CRITICAL", "🚨 CRITICAL WATCHLIST TARGET DETECTED: Plate TN09BV1907 sighted at Kathipara Junction. Armed Robbery Getaway Vehicle (Ref: FIR-2026-4491)", now - timedelta(minutes=42), "ACTIVE", json.dumps({"plate_number": "TN09BV1907", "priority": "CRITICAL", "division": "South Traffic Headquarters"})),
        ("CAM10", "WATCHLIST_HIT", "HIGH", "🚨 HIGH PRIORITY TARGET DETECTED: Plate TN01AB1234 sighted at T. Nagar Panagal Park. Fatal Hit-and-Run investigation (Ref: HNR-2026-0812)", now - timedelta(hours=4, minutes=15), "ACTIVE", json.dumps({"plate_number": "TN01AB1234", "priority": "HIGH", "division": "South Chennai Traffic Division"})),
    ]

    for cam, a_type, sev, msg, det_at, st, meta in alerts_seed:
        cur.execute("""
            INSERT INTO alerts (
                camera_id, alert_type, severity, message, detected_at, status, metadata, created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
        """, (cam, a_type, sev, msg, det_at, st, meta, det_at))
    conn.commit()

    cur.close()
    conn.close()
    print("\n" + "=" * 70, flush=True)
    print("SUCCESS: ALL HISTORICAL INTELLIGENCE & BASELINE DATA SEEDED!", flush=True)
    print("=" * 70, flush=True)


if __name__ == "__main__":
    seed_database()
