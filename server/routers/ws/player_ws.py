"""
Player WebSocket endpoint 
Each player device connects here with a room PIN to join the game.
Handles join, reconnect, input, and disconnect.
"""

from __future__ import annotations
import json, logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from game.room_manager import room_manager, RoomState
from game.connection_manager import connection_manager
from models.messages import (
    JoinAckPayload,
    PlayerJoinedBroadcast,
    PlayerLeftBroadcast,
    ErrorPayload,
    PongPayload,
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.websocket("/ws/player")
async def player_endpoint(websocket: WebSocket):
    await websocket.accept()
    player = None
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
                        message="Message must be valid JSON"
                    )
                )
                continue
 
            msg_type = data.get("type")
 
            # Join or reconnect 
            if msg_type == "JOIN_ROOM":
                pin = data.get("room_pin", "").strip()
                name = data.get("player_name", "").strip()[:20]  # cap name length
                existing_id = data.get("player_id")  # show only on reconnect
 
                target_room = room_manager.get_room(pin)
                if not target_room:
                    await connection_manager.send(
                        websocket,
                        ErrorPayload(
                            code="ROOM_NOT_FOUND",
                            message=f"No room with PIN {pin}"
                        )
                    )
                    continue
 
                if existing_id and existing_id in target_room.players:
                    # Silent reconnect to restore existing slot
                    player = room_manager.reconnect_player(target_room, existing_id, websocket)
                    room = target_room
                    logger.info(f"Player {player.player_name} reconnected to room {pin}")
                    await connection_manager.send(
                        websocket,
                        JoinAckPayload(
                            player_id=player.player_id,
                            room_pin=room.pin,
                            player_name=player.player_name
                        )
                    )
                    continue

                # fresh join
                if target_room.is_full():
                    await connection_manager.send(
                        websocket,
                        ErrorPayload(
                            code="ROOM_FULL",
                            message="This room is full"
                        )
                    )
                    continue
                if not name:
                    await connection_manager.send(
                        websocket,
                        ErrorPayload(
                            code="NAME_REQUIRED",
                            message="player_name is required"
                        )
                    )
                    continue

                player = room_manager.add_player(target_room, name, websocket)
                room = target_room
                logger.info(f"Player {name} joined room {pin} ({room.player_count()} total)")

                # acknowledge the joining player FIRST so they don't receive PLAYER_JOINED
                # before they know their own player_id
                await connection_manager.send(
                    websocket,
                    JoinAckPayload(
                        player_id=player.player_id,
                        room_pin=room.pin,
                        player_name=player.player_name,
                    ),
                )

                # player joined broadcast to host and existing players only
                broadcast = PlayerJoinedBroadcast(
                    player_id=player.player_id,
                    player_name=player.player_name,
                    player_count=room.player_count(),
                )
                await connection_manager.broadcast_to_host(room, broadcast)
                for pid, p in room.players.items():
                    if pid != player.player_id:
                        await connection_manager.send(p.websocket, broadcast)
 
            # Input during game
            elif msg_type == "PLAYER_INPUT":
                if not player or not room:
                    continue
                if room.state != RoomState.IN_GAME:
                    continue
 
                action = data.get("action", "IDLE")
                valid_actions = {"MOVE_UP", "MOVE_DOWN", "MOVE_LEFT", "MOVE_RIGHT", "IDLE"}
                if action not in valid_actions:
                    continue
 
                # This is where we call the C++ engine
                if room.engine is not None:
                    room.engine.apply_input(player.player_id, action)
                    
                logger.debug(f"Input: {player.player_name} → {action}")
 
            # Heartbeat 
            elif msg_type == "PING":
                await connection_manager.send(websocket, PongPayload())
 
            else:
                logger.debug(f"Unknown player message: {msg_type}")
 
    except WebSocketDisconnect:
        if player and room:
            # don't remove player. Just mark them as diconnected so they can reconnect
            player.is_alive = False
            player.websocket = None
            logger.info(f"Player {player.player_name} temporarily disconnected from room {room.pin}")

            # notify only the HOST if a player leaves
            if room.host_websocket:
                await connection_manager.send(
                    room.host_websocket,
                    PlayerLeftBroadcast(
                        player_id=player.player_id,
                        player_name=player.player_name,
                        player_count=sum(1 for p in room.players.values() if p.is_alive) # count only alive players
                    )
                )