import os
import subprocess
import sys
import time

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))

# Auto-detect project virtual environment python
VENV_PYTHON_WIN = os.path.join(PROJECT_DIR, "venv", "Scripts", "python.exe")
VENV_PYTHON_UNIX = os.path.join(PROJECT_DIR, "venv", "bin", "python")

if os.path.exists(VENV_PYTHON_WIN):
    PYTHON_EXE = VENV_PYTHON_WIN
elif os.path.exists(VENV_PYTHON_UNIX):
    PYTHON_EXE = VENV_PYTHON_UNIX
else:
    PYTHON_EXE = sys.executable

PROCESSES = [
    ("FastAPI", [PYTHON_EXE, "-m", "uvicorn", "app.main:app"]),
    ("Redis Consumer", [PYTHON_EXE, "redis_consumer.py"]),
    ("Trajectory Publisher", [PYTHON_EXE, "trajectory_event_publisher.py"]),
    ("Route Anomaly Worker", [PYTHON_EXE, "route_anomaly_worker.py"]),
    ("Camera Health Worker", [PYTHON_EXE, "camera_health_worker.py"]),
    ("Analytics Worker", [PYTHON_EXE, "analytics_worker.py"]),
]

if "--demo" in sys.argv:
    PROCESSES.append(("Live Simulation Streamer", [PYTHON_EXE, "demo_streamer.py", "--speed", "1.5"]))

processes = []

print("=" * 70)
print("CITY TRAFFIC SYSTEM")
print(f"Python interpreter: {PYTHON_EXE}")
print("=" * 70)
print()

env = os.environ.copy()
if os.path.exists(VENV_PYTHON_WIN):
    venv_scripts = os.path.join(PROJECT_DIR, "venv", "Scripts")
    env["PATH"] = venv_scripts + os.pathsep + env.get("PATH", "")

for name, command in PROCESSES:
    print(f"Starting {name}...")

    process = subprocess.Popen(
        command,
        cwd=PROJECT_DIR,
        env=env,
        creationflags=subprocess.CREATE_NEW_CONSOLE
    )

    processes.append((name, process))

    print(f"{name} started. PID: {process.pid}")
    time.sleep(1)

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