import os
import subprocess
import sys
import time

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))

PROCESSES = [
    ("FastAPI", [sys.executable, "-m", "uvicorn", "app.main:app"]),
    ("Redis Consumer", [sys.executable, "redis_consumer.py"]),
    ("Trajectory Publisher", [sys.executable, "trajectory_event_publisher.py"]),
    ("Route Anomaly Worker", [sys.executable, "route_anomaly_worker.py"]),
    ("Camera Health Worker", [sys.executable, "camera_health_worker.py"]),
    ("Analytics Worker", [sys.executable, "analytics_worker.py"]),
]

processes = []

print("=" * 70)
print("CITY TRAFFIC SYSTEM")
print("=" * 70)
print()

for name, command in PROCESSES:
    print(f"Starting {name}...")

    process = subprocess.Popen(
        command,
        cwd=PROJECT_DIR,
        creationflags=subprocess.CREATE_NEW_CONSOLE
    )

    processes.append((name, process))

    print(f"{name} started. PID: {process.pid}")
    time.sleep(2)

print()
print("=" * 70)
print("ALL SYSTEM PROCESSES STARTED")
print("=" * 70)
print()
print("Press Ctrl+C in this launcher window to stop monitoring.")
print()

try:
    while True:
        for name, process in processes:
            if process.poll() is not None:
                print(
                    f"WARNING: {name} stopped. "
                    f"Exit code: {process.returncode}"
                )

        time.sleep(5)

except KeyboardInterrupt:
    print()
    print("Stopping all system processes...")

    for name, process in processes:
        if process.poll() is None:
            process.terminate()
            print(f"Stopped: {name}")

    print("System stopped.")