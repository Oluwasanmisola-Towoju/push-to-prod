"""
Host WebSocket routes
The projector machine may  connect here to create/own a room and receive game state updates,
but it won't send player input messages like the player websockets do.
"""

from __future__ import annotations
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from game.room_manager import room_manager, RoomState
from game.connection_manager import connection_manager
from models.messages import (
    RoomCreatedPayload,
    PlayerJoinedBroadcast,
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
                room.state = RoomState.IN_GAME
                await connection_manager.broadcast_to_room(
                    room,
                    {
                        "type": "GAME_STARTED",
                        "room_pin": room.pin
                    }
                )
                logger.info(f"Game started in room {room.pin}")
            
            elif msg_type == "PING":
                await connection_manager.send(websocket, PongPayload())
            
            else:
                logger.debug(f"Unknown host message type: {msg_type}")
    
    except WebSocketDisconnect:
        logger.info(f"Host disconnected from room {room.pin if room else 'unknown'}")
        if room: 
            await connection_manager.broadcast_to_players(
                room,
                {
                    "type": "HOST_DISCONNECTED",
                    "message": "Host left the game"
                }
            )
            room_manager.destroy_room(room.pin)