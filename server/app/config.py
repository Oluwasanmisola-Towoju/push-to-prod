import os

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 8000))

# CORS settings, lock this down to your deployed frontend URL in production
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173," \
    "http://localhost:5174"
).split(",")

# Game settings
TICK_RATE_HZ = int(os.getenv("TICK_RATE_HZ", 20))
MAX_PLAYERS_PER_ROOM = int(os.getenv("MAX_PLAYERS", 50))
PIN_LENGTH = int(os.getenv("PIN_LENGTH", 4))