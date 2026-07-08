"""
Host WebSocket routes
The projector machine may  connect here to create/own a room and receive game state updates,
but it won't send player input messages like the player websockets do.
"""

from __future__ import annotations
import json, logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from game.room_manager import room_manager, RoomState
from game.connection_manager import connection_manager
from models.messages import (
    RoomCreatedPayload,
    ErrorPayload,
    PongPayload
)

router = APIRouter()
logger = logging.getLogger(__name__)

@router.websocket("/ws/host")
async def host_endpoint(websocket: WebSocket):
    await websocket.accept()
    room = None

    try:
        while True:
            raw = await websocket.receive_text()

            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await connection_manager.send(
                    websocket,
                    ErrorPayload(
                        code="INVALID_JSON",
                        message="Message must be a valid JSON"
                    )
                )
                continue
                
            msg_type = data.get("type")

            if msg_type == "CREATE_ROOM":
                room = room_manager.create_room()
                room.host_websocket = websocket
                logger.info(f"Room created: {room.pin}")

                await connection_manager.send(
                    websocket,
                    RoomCreatedPayload(room_pin=room.pin)
                )

            elif msg_type == "START_GAME":
                if not room:
                    await connection_manager.send(
                        websocket,
                        ErrorPayload(
                            code="NO_ROOM",
                            message="Create a room first"
                        )
                    )
                    continue

                # boot C++ engine instance 
                engine_ready = room.start_engine()
                if not engine_ready:
                    await connection_manager.send(
                        websocket,
                        ErrorPayload(
                            code="ENGINE_NOT_READY",
                            message="C++ engine not loaded"
                        )
                    )
                room.state = RoomState.IN_GAME
                await connection_manager.broadcast_to_room(
                    room,
                    {
                        "type": "GAME_STARTED",
                        "room_pin": room.pin
                    }
                )
                logger.info(
                    f"Game started in room {room.pin} |  "
                    f"{room.player_count()} player(s) | engine ready: {engine_ready}"
                )
            
            elif msg_type == "PING":
                await connection_manager.send(websocket, PongPayload())
    
    except WebSocketDisconnect:
        pin_str = room.pin if room else "unknown"
        logger.info(f"Host disconnected from room {pin_str}")
        if room:
            await connection_manager.broadcast_to_players(
                room, {"type": "HOST_DISCONNECTED", "message": "Host left the game"}
            )
            room_manager.destroy_room(room.pin)