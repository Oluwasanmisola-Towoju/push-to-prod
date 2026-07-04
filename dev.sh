#!/bin/bash
# Exit immediately if any command or test exits with a non-zero status
set -e 

echo "====================================================="
echo "  Push to Prod — Test & Launch Pipeline              "
echo "====================================================="

# ---------------------------------------------------------
# 1. Compile C++ Engine and Run Unit Tests
# ---------------------------------------------------------
echo -e "\n---> [1/4] Building C++ Engine & Executing Tests..."
cd engine
mkdir -p build
cd build

# Configure CMake
cmake -DBUILD_PYBIND=ON ..

# replaced 'make' with CMake's cross-platform build command.
# '--config Release' to optimize the C++ physics engine for performance.
cmake --build . --config Release

echo -e "\n---> Running C++ Physics Tests..."
./Release/engine_test.exe

cd ../..

# ---------------------------------------------------------
# 2. Python Virtual Environment Setup
# ---------------------------------------------------------
echo -e "\n---> [2/4] Setting up Python Virtual Environment..."
if [ ! -d "venv" ]; then
    echo "Creating new virtual environment..."
    python -m venv venv 
fi

# cross-platform virtual environment activation
if [ -f "venv/Scripts/activate" ]; then
    # Windows Git Bash path
    source venv/Scripts/activate
else
    # Linux/macOS path
    source venv/bin/activate
fi

# Install dependencies from the server folder
pip install -r server/requirements.txt

# ---------------------------------------------------------
# 3. Python Integration Tests
# ---------------------------------------------------------
echo -e "\n---> [3/4] Running Python Integration Tests..."
python tests/integration_test.py

# ---------------------------------------------------------
# 4. Spin Up All Services
# ---------------------------------------------------------
echo -e "\n---> [4/4] All tests passed! Spinning up dev servers..."

cleanup() {
    echo -e "\n\n---> Shutting down all Push to Prod services..."
    # kill all background processes started by this script
    kill $(jobs -p) 2>/dev/null
    exit
}
trap cleanup EXIT INT

# Start FastAPI Backend
echo "Starting FastAPI Backend..."
cd server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
cd ..

# Start Client Frontend
echo "Starting Client Frontend..."
cd frontend/client
npm install --silent
npm run dev &
cd ../..

# Start Host Frontend
echo "Starting Host Frontend..."
cd frontend/host
npm install --silent
npm run dev &
cd ../..

echo -e "\n====================================================="
echo "  All services are running successfully!               "
echo "  Backend API: http://localhost:8000                   "
echo "  Client App:  http://localhost:5173                   "
echo "  Host Screen: http://localhost:5174                   "
echo "  Press Ctrl+C to stop all services.                   "
echo "====================================================="

wait