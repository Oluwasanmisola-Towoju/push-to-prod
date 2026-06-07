"""
Push to Prod fastAPI backend, Run with: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import HOST, PORT, CORS_ORIGINS
from routers.ws.host_ws import router as host_router
from routers.ws.player_ws import router as player_router
from server.game.room_manager import room_manager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname) -8s | %(name)s | %(message)s",
    )
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Push to Prod",
    description="Real-time multiplayer party game backend",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(host_router)
app.include_router(player_router)

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "active_rooms": room_manager.active_room_count(),
        "active_players": room_manager.active_player_count()
    }

@app.on_event("startup")
async def startup_event():
    logger.info(f"Starting Push to Prod server on {HOST}:{PORT}")  
    logger.info(f"CORS allowed origins: {CORS_ORIGINS}")