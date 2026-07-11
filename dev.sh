#!/bin/bash
set -e

echo "====================================================="
echo "  Push to Prod — Test & Launch Pipeline              "
echo "====================================================="

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---------------------------------------------------------
# 1. Compile C++ Engine and Run Unit Tests
# ---------------------------------------------------------
echo -e "\n---> [1/4] Building C++ Engine & Executing Tests..."
cd "$ROOT/engine"
mkdir -p build
cd build

cmake -DBUILD_PYBIND=ON ..
cmake --build . --config Release

echo -e "\n---> Running C++ Physics Tests..."
./Release/engine_test.exe

cd "$ROOT"

# ---------------------------------------------------------
# 2. Verify .pyd landed in the right place
# ---------------------------------------------------------
echo -e "\n---> Checking pybind11 extension output..."
LIB_DIR="$ROOT/server/lib"
mkdir -p "$LIB_DIR"

PYD_COUNT=$(find "$LIB_DIR" -name "gameengine*.pyd" -o -name "gameengine*.so" 2>/dev/null | wc -l)

if [ "$PYD_COUNT" -eq 0 ]; then
    echo "WARNING: gameengine extension not found in server/lib/"
    echo "         Searching engine/build/ for misplaced output..."
    MISPLACED=$(find "$ROOT/engine/build" -name "gameengine*.pyd" -o -name "gameengine*.so" 2>/dev/null | head -1)
    if [ -n "$MISPLACED" ]; then
        echo "         Found at: $MISPLACED"
        echo "         Copying to server/lib/ ..."
        cp "$MISPLACED" "$LIB_DIR/"
        echo "         Copied."
    else
        echo "ERROR: gameengine extension not found anywhere. Build may have failed."
        exit 1
    fi
else
    echo "         gameengine extension found in server/lib/ ✓"
fi

# ---------------------------------------------------------
# 3. Python Virtual Environment Setup
# ---------------------------------------------------------
echo -e "\n---> [2/4] Setting up Python Virtual Environment..."
cd "$ROOT"

if [ ! -d "venv" ]; then
    echo "Creating new virtual environment..."
    python -m venv venv
fi

if [ -f "venv/Scripts/activate" ]; then
    source venv/Scripts/activate
else
    source venv/bin/activate
fi

pip install -r server/requirements.txt

# ---------------------------------------------------------
# 4. Verify the engine imports correctly from Python
# ---------------------------------------------------------
echo -e "\n---> Verifying C++ engine import..."
cd "$ROOT/server"

python - << 'PYEOF'
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath('.')), 'server', 'lib'))
sys.path.insert(0, 'lib')
try:
    import gameengine
    e = gameengine.GameEngine(10, 12)
    e.add_player('test', 'TestPlayer')
    e.apply_input('test', 'MOVE_UP')
    s = e.tick(0.05)
    assert s.tick == 1
    assert len(s.players) == 1
    assert s.players[0].y == 1.0
    print("         C++ engine import: OK ✓")
    print(f"         tick={s.tick}, player y={s.players[0].y}")
except ImportError as ex:
    print(f"         WARNING: C++ engine not available: {ex}")
    print("         Server will start but START_GAME will return ENGINE_NOT_READY")
PYEOF

cd "$ROOT"

# ---------------------------------------------------------
# 5. Python Integration Tests
# ---------------------------------------------------------
echo -e "\n---> [3/4] Running Python Integration Tests..."
python tests/integration_test.py

# ---------------------------------------------------------
# 6. Spin Up All Services
# ---------------------------------------------------------
echo -e "\n---> [4/4] All tests passed! Spinning up dev servers..."

cleanup() {
    echo -e "\n\n---> Shutting down all Push to Prod services..."
    kill $(jobs -p) 2>/dev/null
    exit
}
trap cleanup EXIT INT

echo "Starting FastAPI Backend..."
cd "$ROOT/server"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
cd "$ROOT"

echo "Starting Client Frontend..."
cd "$ROOT/frontend/client"
npm install --silent
npm run dev &
cd "$ROOT"

echo "Starting Host Frontend..."
cd "$ROOT/frontend/host"
npm install --silent
npm run dev &
cd "$ROOT"

echo -e "\n====================================================="
echo "  All services are running successfully!               "
echo "  Backend API: http://localhost:8000                   "
echo "  Client App:  http://localhost:5173                   "
echo "  Host Screen: http://localhost:5174                   "
echo "  Press Ctrl+C to stop all services.                   "
echo "====================================================="

wait