"""
Handle sending messages to individual sockets
and broadcasting to all players in a room or host screen.
"""

from __future__ import annotations
import json
import logging
from fastapi import WebSocket
from pydantic import BaseModel

from game.room_manager import Room

logger = logging.getLogger(__name__)

class ConnectionManager:

    async def send(self, websocket: WebSocket, payload: BaseModel | dict) -> bool:
        """Send a message to a specific websocket connection. Return false if send failed. """
        try:
            data = payload.model_dump_json() if isinstance(payload, BaseModel) else json.dumps(payload)
            await websocket.send_text(data)
            return True
        except Exception as e:
            logger.warning(f"Failed to send message to websocket: {e}")
            return False
    
    async def broadcast_to_players(self, room: Room, payload: BaseModel | dict):
        """Broadcast a message to all player websockets in a room."""
        data = payload.model_dump_json() if isinstance(payload, BaseModel) else json.dumps(payload)
        dead_ids = []
        for player_id, player in room.players.items():
            try:
                await player.websocket.send_text(data)
            except Exception as e:
                dead_ids.append(player_id)
                logger.warning(f"Failed to send message to player {player_id} in room {room.pin}: {e}")
        # Clean up dead connections
        for pid in dead_ids:
            logger.info(f"Cleaning up dead connection for player {pid} in room {room.pin}")
            room.players.pop(pid, None)
    
    async def broadcast_to_host(self, room: Room, payload: BaseModel | dict) -> None:
        """Broadcast a message to the host of a room."""
        if room.host_websocket:
            data = payload.model_dump_json() if isinstance(payload, BaseModel) else json.dumps(payload)
            try:
                await room.host_websocket.send_text(data)
            except Exception as e:
                logger.warning(f"Failed to send message to host in room {room.pin}: {e}")
                room.host_websocket = None  # Clean up dead host connection
    
    async def broadcast_to_room(self, room: Room, payload: BaseModel | dict) -> None:
        """Broadcast a message to all players and the host in a room."""
        await self.broadcast_to_players(room, payload)
        await self.broadcast_to_host(room, payload)

    def get_player_states(self, room: Room) -> list[dict]:
        """Get the current state of all players in a room for broadcasting."""
        return [
            {
                "player_id": p.player_id,
                "player_name": p.player_name,
                "is_alive": p.is_alive,
                "score": p.score,
                "x": p.x,
                "y": p.y
            }
            for p in room.players.values()
        ]

connection_manager = ConnectionManager()