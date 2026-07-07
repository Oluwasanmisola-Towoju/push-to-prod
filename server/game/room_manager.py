from __future__ import annotations
import random, uuid, string, sys, os
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Any
from fastapi import WebSocket

from core.config import PIN_LENGTH, MAX_PLAYERS_PER_ROOM

try:
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
    import gameengine as _cpp  # type: ignore[import]
    CppEngine = _cpp.GameEngine
    print("[engine] C++ Game Engine loaded successfully.")
except ImportError as _e:
    CppEngine = None
    print(f"[engine] WARNING: C++ Game Engine failed to load. ({_e})")
    print("[engine]       Run: cmake --build engine/build --config Release")

class RoomState(str, Enum):
    LOBBY = "lobby"
    IN_GAME = "in_game"
    FINISHED = "finished"

@dataclass
class Player:
    player_id: str
    player_name: str
    websocket: WebSocket
    is_alive: bool = True
    score: int = 0
    x: float = 6.0  # center of grid
    y: float = 0.0  # bottom row of grid 

@dataclass
class Room:
    pin: str
    state: RoomState = RoomState.LOBBY
    players: dict[str, Player] = field(default_factory=dict)
    host_websocket: Optional[WebSocket] = None
    engine: Optional[Any] = None

    def player_count(self) -> int:
        return len(self.players)

    def is_full(self) -> bool:
        return self.player_count() >= MAX_PLAYERS_PER_ROOM
    
    def start_engine(self) -> bool:
        """ Instantiate a fresh C++ GameEngine for this room"""
        if CppEngine is None:
            return False
        self.engine = CppEngine(10, 12)  # grid size 10x12
        for pid, p in self.players.items():
            self.engine.add_player(pid, p.player_name)
        return True

    def to_player_list(self) -> list[dict]:
        return [
            {
                "player_id": p.player_id,
                "player_name": p.player_name,
                "is_alive": p.is_alive,
                "score": p.score,
                "x": p.x,
                "y": p.y
            }
            for p in self.players.values()
        ]

class RoomManager:
    def __init__(self):
        self._rooms: dict[str, Room] = {}

    # Room lifecycle management

    def create_room(self) -> Room:
        pin = self._generate_pin()
        room = Room(pin=pin)
        self._rooms[pin] = room
        return room

    def get_room(self, pin: str) -> Optional[Room]:
        return self._rooms.get(pin)

    def destroy_room(self, pin: str) -> None:
        self._rooms.pop(pin, None)
    
    # Player management

    def add_player(
        self,
        room: Room,
        player_name: str,
        websocket: WebSocket,
        player_id: Optional[str] = None
    ) -> Optional[Player]:
        if room.is_full():
            return None
        pid = player_id or str(uuid.uuid4())
        player = Player(
            player_id=pid,
            player_name=player_name,
            websocket=websocket
        )
        room.players[pid] = player
        # if the game is already running, add them to the live engine too
        if room.engine is not None:
            room.engine.add_player(pid, player_name)
        return player
    
    def remove_player(self, room: Room, player_id: str) -> Optional[Player]:
        player = room.players.pop(player_id, None)
        if player and room.engine is not None:
            room.engine.remove_player(player_id)
        return player

    def reconnect_player(
        self,
        room: Room,
        player_id: str,
        new_websocket: WebSocket
    ) -> Optional[Player]:
        player = room.players.get(player_id)
        if player:
            player.websocket = new_websocket
        return player
    
    # helper functions
    def _generate_pin(self) -> str:
        while True:
            pin = "".join(random.choices(string.digits, k=PIN_LENGTH))
            if pin not in self._rooms:
                return pin  
    
    def active_room_count(self) -> int:
        return len(self._rooms)
    
    def all_rooms(self) -> list[Room]:
        return list(self._rooms.values())
    
    def active_player_count(self) -> int:
        return sum(room.player_count() for room in self._rooms.values())

# single instance of RoomManager to be used across the app
room_manager = RoomManager()