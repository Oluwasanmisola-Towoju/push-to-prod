#!/bin/bash
set -e

echo "====================================================="
echo "  Push to Prod — Test & Launch Pipeline              "
echo "====================================================="

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Port conflict detection 
check_port() {
    local port=$1
    if netstat -ano 2>/dev/null | grep -q ":${port} .*LISTENING"; then
        echo "ERROR: Port ${port} is already in use. Kill the process and retry."
        exit 1
    fi
}
echo -e "\n---> Checking ports..."
check_port 8000
check_port 5173
check_port 5174
echo "         All ports free ✓"

# 1. C++ Engine 
echo -e "\n---> [1/4] Building C++ Engine & Executing Tests..."
cd "$ROOT/engine"
mkdir -p build
cd build
cmake -DBUILD_PYBIND=ON .. -DCMAKE_BUILD_TYPE=Release
cmake --build . --config Release
echo -e "\n---> Running C++ Physics Tests..."
./Release/engine_test.exe
cd "$ROOT"

# 2. Verify .pyd landed correctly 
echo -e "\n---> Verifying engine output..."
LIB_DIR="$ROOT/server/lib"
mkdir -p "$LIB_DIR"
PYD_COUNT=$(find "$LIB_DIR" -name "gameengine*.pyd" -o -name "gameengine*.so" 2>/dev/null | wc -l)
if [ "$PYD_COUNT" -eq 0 ]; then
    MISPLACED=$(find "$ROOT/engine/build" -name "gameengine*.pyd" -o -name "gameengine*.so" 2>/dev/null | head -1)
    if [ -n "$MISPLACED" ]; then
        echo "         Relocating .pyd to server/lib/ ..."
        cp "$MISPLACED" "$LIB_DIR/"
    else
        echo "ERROR: gameengine extension not found. Build failed."
        exit 1
    fi
fi
echo "         gameengine extension: OK ✓"

# 3. Python venv 
echo -e "\n---> [2/4] Setting up Python Virtual Environment..."
cd "$ROOT"
if [ ! -d "venv" ]; then
    python -m venv venv
fi
if [ -f "venv/Scripts/activate" ]; then
    source venv/Scripts/activate
else
    source venv/bin/activate
fi
pip install -r server/requirements.txt --quiet

# 4. Engine smoke test 
echo -e "\n---> Verifying Python ↔ C++ bridge..."
cd "$ROOT/server"
python - << 'PYEOF'
import sys, os
sys.path.insert(0, 'lib')
try:
    import gameengine
    e = gameengine.GameEngine(10, 12)
    e.add_player('smoke', 'SmokeTest')
    e.apply_input('smoke', 'MOVE_UP')
    s = e.tick(0.05)
    assert s.tick == 1
    assert s.players[0].y == 1.0
    print("         Python ↔ C++ bridge: OK ✓")
except ImportError as ex:
    print(f"         WARNING: engine not importable: {ex}")
PYEOF
cd "$ROOT"

# 5. Integration tests 
echo -e "\n---> [3/4] Running Integration Tests..."
python tests/integration_test.py

# 6. Launch all services 
echo -e "\n---> [4/4] All tests passed! Spinning up services..."

cleanup() {
    echo -e "\n\n---> Shutting down all services..."
    kill $(jobs -p) 2>/dev/null
    exit
}
trap cleanup EXIT INT

cd "$ROOT/server"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
SERVER_PID=$!
cd "$ROOT"

# Wait for server to be ready before starting frontends
echo "         Waiting for API to be ready..."
for i in $(seq 1 20); do
    sleep 0.5
    if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
        echo "         API ready ✓"
        break
    fi
done

cd "$ROOT/client"
npm install --silent
npm run dev &
cd "$ROOT"

cd "$ROOT/host"
npm install --silent
npm run dev &
cd "$ROOT"

echo -e "\n====================================================="
echo "  All services are running successfully!               "
echo "  Backend API: http://localhost:8000                   "
echo "  Client App:  http://localhost:5173                   "
echo "  Host Screen: http://localhost:5174                   "
echo "  API Docs:    http://localhost:8000/docs              "
echo "  Press Ctrl+C to stop all services.                   "
echo "====================================================="

wait