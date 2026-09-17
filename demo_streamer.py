"""
Scenario-Driven Real-Time Traffic Simulation Streamer (NeuralGrid)
Continuously streams normalized ANPR vehicle observations into the Redis stream
('anpr_events') to simulate distributed smart-city CCTV edge cameras.

Features:
1. 25-30 Minute Recursive Looping: Never dies or runs out of live traffic.
2. 5 Scripted Storyline Incidents:
   - Story 1: Normal Flow & Continuous Trajectory Stitching
   - Story 2: Critical Watchlist Target Sighting & Interception
   - Story 3: Route Travel-Time Anomaly (2σ statistical breakdown/detour)
   - Story 4: Camera Heartbeat Dropout (Healthy -> Warning -> Offline -> Recovery)
   - Story 5: Traffic Jam Congestion Surge & Cascade Delay Propagation
   - Story 6: Coordinated Convoy Detection (3+ vehicles tight headway)
3. Dynamic Speed Control (--speed 1x, 2x, 3x).
4. Interactive On-Demand CLI Hotkeys (Press 'w', 'a', 'c', 'j', 'k' to trigger anytime).
"""

import argparse
import json
import random
import sys
import threading
import time
from datetime import datetime, timezone

from redis_producer import publish_anpr_event
from app.database import get_redis_client

# ====================================================================
# Camera Geometries & Road Topology
# ====================================================================

CAMERAS = {
    "CAM01": {"name": "Kathipara Junction ANPR", "lon": 80.2045, "lat": 13.0068},
    "CAM02": {"name": "Gemini Flyover ANPR", "lon": 80.2505, "lat": 13.0528},
    "CAM03": {"name": "Madhya Kailash Junction ANPR", "lon": 80.2462, "lat": 13.0066},
    "CAM04": {"name": "Taramani Tech Park ANPR", "lon": 80.2510, "lat": 12.9759},
    "CAM05": {"name": "Koyambedu CMBT Junction ANPR", "lon": 80.1980, "lat": 13.0694},
    "CAM06": {"name": "Velachery Checkpost ANPR", "lon": 80.2220, "lat": 12.9750},
    "CAM07": {"name": "Sholinganallur Junction ANPR", "lon": 80.2495, "lat": 12.9400},
    "CAM08": {"name": "Chennai Airport Terminal ANPR", "lon": 80.1700, "lat": 12.9800},
    "CAM09": {"name": "Chennai Central Station ANPR", "lon": 80.2750, "lat": 13.0820},
    "CAM10": {"name": "T. Nagar Panagal Park ANPR", "lon": 80.2300, "lat": 13.0400},
}

COMMUTER_ROUTES = [
    # Route 1: Airport to Central
    ["CAM08", "CAM01", "CAM10", "CAM02", "CAM09"],
    # Route 2: Airport to OMR IT Corridor
    ["CAM08", "CAM01", "CAM06", "CAM04", "CAM07"],
    # Route 3: Central to OMR via Gemini
    ["CAM09", "CAM02", "CAM03", "CAM04", "CAM07"],
    # Route 4: Koyambedu to Velachery
    ["CAM05", "CAM10", "CAM01", "CAM06"],
    # Route 5: OMR Inbound to City
    ["CAM07", "CAM04", "CAM03", "CAM02", "CAM09"]
]

BACKGROUND_VEHICLES = [
    {"plate": "TN01AA2041", "type": "Car", "make": "Hyundai", "model": "i20", "color": "Silver"},
    {"plate": "TN02BB3189", "type": "Car", "make": "Maruti", "model": "Swift", "color": "White"},
    {"plate": "TN07CC4590", "type": "Car", "make": "Honda", "model": "City", "color": "Grey"},
    {"plate": "TN09DD5120", "type": "Bus", "make": "MTC Chennai", "model": "Deluxe", "color": "Red"},
    {"plate": "TN10EE6734", "type": "Motorcycle", "make": "Royal Enfield", "model": "Classic 350", "color": "Black"},
    {"plate": "TN14FF7812", "type": "Auto", "make": "Bajaj", "model": "RE Compact", "color": "Yellow"},
    {"plate": "TN18GG8923", "type": "Car", "make": "Tata", "model": "Nexon", "color": "Blue"},
    {"plate": "TN22HH9045", "type": "Truck", "make": "Eicher", "model": "Pro 2049", "color": "White"},
]

# Storyline Active Flags / Triggers
HOTKEY_TRIGGER = None
CAMERA_04_MUTED = False
SIMULATION_RUNNING = True


def emit_event(camera_id: str, plate: str, vtype: str = "Car", make: str = "Hyundai",
               model: str = "Creta", color: str = "White", heading: float = 45.0,
               confidence: float = 0.98, timestamp: str = None):
    """Publish a single normalized ANPR observation to Redis."""
    cam = CAMERAS.get(camera_id, {"lat": 13.0068, "lon": 80.2045})
    ts = timestamp or datetime.now(timezone.utc).isoformat()
    payload = {
        "camera_id": camera_id,
        "plate": plate,
        "timestamp": ts,
        "confidence": confidence,
        "latitude": cam["lat"],
        "longitude": cam["lon"],
        "vehicle_type": vtype,
        "make": make,
        "model": model,
        "color": color,
        "heading": heading
    }
    publish_anpr_event(payload)
    return payload


# ====================================================================
# Scripted Storyline Injections
# ====================================================================

def trigger_storyline_watchlist():
    """STORY 2: BOLO Watchlist Target Sighting & Interception."""
    print("\n" + "!" * 70)
    print("[DEMO STORYLINE 2] TRIGGERING CRITICAL WATCHLIST HIT (TN09BV1907)")
    print("!" * 70)
    emit_event("CAM01", "TN09BV1907", "Car", "Toyota", "Fortuner", "Black", heading=35.0, confidence=0.99)
    print(" -> Sighted TN09BV1907 at CAM01 (Kathipara Junction). Alert fired to /ws/traffic!")

    time.sleep(3.0)
    emit_event("CAM02", "TN09BV1907", "Car", "Toyota", "Fortuner", "Black", heading=38.0, confidence=0.98)
    print(" -> TN09BV1907 reached CAM02 (Gemini Flyover). Journey trajectory synthesized!")
    print("!" * 70 + "\n")


def trigger_storyline_route_anomaly():
    """STORY 3: Statistical Route Travel-Time Anomaly (> 2sigma outlier)."""
    print("\n" + "!" * 70)
    print("[DEMO STORYLINE 3] TRIGGERING ROUTE TRAVEL-TIME ANOMALY (TN07CD4567)")
    print("!" * 70)
    v_plate = "TN07CD4567"
    now_dt = datetime.now(timezone.utc)
    old_ts = (now_dt - datetime.fromtimestamp(980) + datetime.fromtimestamp(0)).isoformat()
    emit_event("CAM01", v_plate, "Car", "Honda", "City", "Silver", confidence=0.96, timestamp=old_ts)
    time.sleep(1.5)
    emit_event("CAM02", v_plate, "Car", "Honda", "City", "Silver", confidence=0.97)
    print(f" -> Vehicle {v_plate} logged extreme travel-time (980s vs 420s baseline).")
    print(" -> Route Anomaly Worker will flag 2-sigma travel-time outlier incident!")
    print("!" * 70 + "\n")


def trigger_storyline_camera_drop():
    """STORY 4: Camera Heartbeat Drop & Recovery."""
    global CAMERA_04_MUTED
    CAMERA_04_MUTED = not CAMERA_04_MUTED
    if CAMERA_04_MUTED:
        print("\n" + "!" * 70)
        print("[DEMO STORYLINE 4] CAM04 (Taramani Tech Park) FEEDS DROPPED!")
        print(" -> CAM04 will transition from HEALTHY -> WARNING -> OFFLINE.")
        print("!" * 70 + "\n")
    else:
        print("\n" + "!" * 70)
        print("[DEMO STORYLINE 4] CAM04 (Taramani Tech Park) FEEDS RESTORED!")
        emit_event("CAM04", "TN04RE9999", "Car", "Hyundai", "Verna", "White")
        print(" -> CAM04 status restored to HEALTHY!")
        print("!" * 70 + "\n")


def trigger_storyline_congestion_surge():
    """STORY 5: Traffic Surge & Delay Cascade Propagation."""
    print("\n" + "!" * 70)
    print("[DEMO STORYLINE 5] INJECTING RAPID TRAFFIC SURGE (Guindy Corridor)")
    print("!" * 70)
    for i in range(8):
        plate = f"TN01SG{random.randint(1000, 9999)}"
        emit_event("CAM01", plate, "Car", "Maruti", "Dzire", "White")
        time.sleep(0.4)
    print(" -> Surge injected! Average delay index spiking on corridor.")
    print("!" * 70 + "\n")


def trigger_storyline_convoy():
    """STORY 6: Coordinated Multi-Vehicle Convoy."""
    print("\n" + "!" * 70)
    print("[DEMO STORYLINE 6] TRIGGERING COORDINATED CONVOY (OMR Corridor)")
    print("!" * 70)
    convoy = ["TN02XY1111", "TN02XY2222", "TN02XY3333"]
    # Checkpoint 1: CAM03
    print(" -> Convoy passing CAM03 (Madhya Kailash) in tight formation...")
    for p in convoy:
        emit_event("CAM03", p, "Truck", "Tata", "407", "Black")
        time.sleep(0.5)

    time.sleep(2.0)
    # Checkpoint 2: CAM04
    print(" -> Convoy passing CAM04 (Taramani Tech Park)...")
    for p in convoy:
        emit_event("CAM04", p, "Truck", "Tata", "407", "Black")
        time.sleep(0.5)

    print(" -> Collective Movement Engine evaluates clustering (< 3s headway).")
    print(" -> Convoy Alert created!")
    print("!" * 70 + "\n")


# ====================================================================
# Interactive Hotkey Listener Thread
# ====================================================================

def hotkey_listener():
    global HOTKEY_TRIGGER, SIMULATION_RUNNING
    print("""
----------------------------------------------------------------------
🎮 LIVE DEMO INTERACTIVE HOTKEYS:
   [w] + Enter : Trigger Watchlist Sighting (TN09BV1907)
   [a] + Enter : Trigger Route Travel-Time Anomaly
   [c] + Enter : Toggle Camera CAM04 Dropout / Recovery
   [j] + Enter : Inject Congestion Traffic Jam
   [k] + Enter : Trigger Coordinated Convoy
   [h] + Enter : Show this hotkey help menu
   [q] + Enter : Stop simulation
----------------------------------------------------------------------
""", flush=True)

    while SIMULATION_RUNNING:
        try:
            line = sys.stdin.readline().strip().lower()
            if not line:
                continue
            if line == 'w':
                HOTKEY_TRIGGER = 'watchlist'
            elif line == 'a':
                HOTKEY_TRIGGER = 'anomaly'
            elif line == 'c':
                HOTKEY_TRIGGER = 'camera'
            elif line == 'j':
                HOTKEY_TRIGGER = 'jam'
            elif line == 'k':
                HOTKEY_TRIGGER = 'convoy'
            elif line == 'h':
                print("""
[w] Watchlist Hit | [a] Route Anomaly | [c] Camera Drop/Recover
[j] Congestion Jam | [k] Convoy Cluster | [q] Quit
""")
            elif line == 'q':
                SIMULATION_RUNNING = False
                print("Stopping simulation streamer...")
                break
        except Exception:
            break


# ====================================================================
# Main Simulation Loop
# ====================================================================

def run_simulation(speed: float = 1.0, loop: bool = True):
    global HOTKEY_TRIGGER, CAMERA_04_MUTED, SIMULATION_RUNNING

    print("=" * 70)
    print("NEURALGRID CITY TRAFFIC SIMULATION STREAMER")
    print(f"Playback Speed: {speed}x | Looping Mode: {'ENABLED (Recursive 25-min)' if loop else 'SINGLE PASS'}")
    print(f"Target Stream : anpr_events (Redis)")
    print("=" * 70)

    # Launch background interactive hotkey thread
    threading.Thread(target=hotkey_listener, daemon=True).start()

    # Active commuting vehicles state
    commuters = []
    for i, v in enumerate(BACKGROUND_VEHICLES):
        route = COMMUTER_ROUTES[i % len(COMMUTER_ROUTES)]
        commuters.append({
            "vehicle": v,
            "route": route,
            "current_step": 0,
            "next_hop_at": time.time() + random.uniform(1.0, 5.0) / speed
        })

    timeline_seconds = 0
    total_events_published = 0
    start_wall_time = time.time()

    try:
        while SIMULATION_RUNNING:
            loop_start = time.time()

            # Check for user on-demand hotkeys
            if HOTKEY_TRIGGER:
                trigger = HOTKEY_TRIGGER
                HOTKEY_TRIGGER = None
                if trigger == 'watchlist':
                    trigger_storyline_watchlist()
                elif trigger == 'anomaly':
                    trigger_storyline_route_anomaly()
                elif trigger == 'camera':
                    trigger_storyline_camera_drop()
                elif trigger == 'jam':
                    trigger_storyline_congestion_surge()
                elif trigger == 'convoy':
                    trigger_storyline_convoy()

            # Automated Storyline Triggers based on Timeline Seconds (1500s = 25 mins)
            # Minute 3:30 (210s) -> Watchlist Hit
            if 210 <= timeline_seconds < 212:
                trigger_storyline_watchlist()

            # Minute 7:00 (420s) -> Route Anomaly
            if 420 <= timeline_seconds < 422:
                trigger_storyline_route_anomaly()

            # Minute 11:00 (660s) -> Camera Drop
            if 660 <= timeline_seconds < 662 and not CAMERA_04_MUTED:
                trigger_storyline_camera_drop()

            # Minute 14:00 (840s) -> Camera Recovery
            if 840 <= timeline_seconds < 842 and CAMERA_04_MUTED:
                trigger_storyline_camera_drop()

            # Minute 16:30 (990s) -> Congestion Jam Surge
            if 990 <= timeline_seconds < 992:
                trigger_storyline_congestion_surge()

            # Minute 20:00 (1200s) -> Convoy Detection
            if 1200 <= timeline_seconds < 1202:
                trigger_storyline_convoy()

            # Background Commuter Movement
            now_time = time.time()
            for c in commuters:
                if now_time >= c["next_hop_at"]:
                    cam_id = c["route"][c["current_step"]]

                    # Skip if camera is muted in simulation
                    if not (cam_id == "CAM04" and CAMERA_04_MUTED):
                        v = c["vehicle"]
                        emit_event(
                            camera_id=cam_id,
                            plate=v["plate"],
                            vtype=v["type"],
                            make=v["make"],
                            model=v["model"],
                            color=v["color"],
                            confidence=round(random.uniform(0.95, 0.99), 2)
                        )
                        total_events_published += 1

                    # Advance to next camera along route
                    c["current_step"] = (c["current_step"] + 1) % len(c["route"])
                    # Realistic hop interval scaled by speed
                    hop_delay = random.uniform(15.0, 30.0) / speed
                    c["next_hop_at"] = now_time + hop_delay

            # Sleep step interval
            step_duration = 1.0 / speed
            time.sleep(max(0.1, step_duration))
            timeline_seconds += 1

            # Print heartbeat ticker every 15 simulated seconds
            if timeline_seconds % 15 == 0:
                elapsed_min = int(timeline_seconds // 60)
                elapsed_sec = int(timeline_seconds % 60)
                print(f"[{elapsed_min:02d}:{elapsed_sec:02d}] Live Stream Active | Events Sent: {total_events_published} | Status: Healthy", flush=True)

            # Check 25-minute cycle wrap-around
            if timeline_seconds >= 1500:
                if loop:
                    print("\n[LOOP RESTART] 25-minute simulation cycle finished. Wrapping around for continuous playback...\n")
                    timeline_seconds = 0
                else:
                    print("\n[COMPLETE] 25-minute single-pass simulation completed.")
                    break

    except KeyboardInterrupt:
        print("\nSimulation streamer interrupted by user.")
    finally:
        SIMULATION_RUNNING = False
        print(f"Total events streamed: {total_events_published}. Streamer shut down.")


# ====================================================================
# Command Line Entry Point
# ====================================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scenario-Driven ANPR Live Simulation Streamer")
    parser.add_argument("--speed", type=float, default=1.0, help="Simulation speed multiplier (e.g. 1.0, 2.0, 3.0)")
    parser.add_argument("--loop", action="store_true", default=True, help="Continuously loop simulation (default: True)")
    parser.add_argument("--once", action="store_true", help="Run once for 25 minutes without looping")
    args = parser.parse_args()

    loop_mode = not args.once
    run_simulation(speed=args.speed, loop=loop_mode)
