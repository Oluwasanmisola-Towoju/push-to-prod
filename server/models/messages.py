"""
All Websocket message shapes, validated by Pydantic
Every message has a 'type' discriminator field to determine the message type, and a 'payload' field that contains the actual data of the message.
"""

from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel

# Inbound: CLient -> Server
class JoinRoomPayload(BaseModel):
    type: Literal["JOIN_ROOM"]
    room_pin: str
    player_name: str
    player_id: Optional[str] = None  # Optional for reconnections

class PlayerInputPayload(BaseModel):
    type: Literal["PLAYER_INPUT"]
    player_id: str 
    # using strict string Literals ensures that rogue data won't even reach the C++ engine, preventing crashes and exploits
    action: Literal["MOVE_UP", "MOVE_DOWN", "MOVE_LEFT", "MOVE_RIGHT", "IDLE"]

class HostCreateRoomPayload(BaseModel):
    type: Literal["CREATE_ROOM"]

class HostStartGamePayload(BaseModel):
    type: Literal["START_GAME"]
    room_pin: str

class HeartbeatPayload(BaseModel):
    type: Literal["PING"]

# Outbound: Server -> Client
class JoinAckPayload(BaseModel):
    type: Literal["JOIN_ACK"] = "JOIN_ACK" # default value ensures that it auto-populates when creating instances
    player_id: str
    room_pin: str
    player_name: str

class RoomCreatedPayload(BaseModel):
    type: Literal["ROOM_CREATED"] = "ROOM_CREATED"
    room_pin: str

class PlayerJoinedBroadcast(BaseModel):
    type: Literal["PLAYER_JOINED"] = "PLAYER_JOINED"
    player_id: str
    player_name: str
    player_count: int

class PlayerLeftBroadcast(BaseModel):
    type: Literal["PLAYER_LEFT"] = "PLAYER_LEFT"
    player_id: str
    player_name: str
    player_count: int

class ErrorPayload(BaseModel):
    type: Literal["ERROR"] = "ERROR"
    message: str
    code: str

class PongPayload(BaseModel):
    type: Literal["PONG"] = "PONG"


class PlayerSnapshot(BaseModel):
    player_id: str
    player_name: str
    x: float
    y: float
    score: int
    is_alive: bool
    stamina: int = 100
    is_invulnerable: bool = False
    invulnerable_for: float = 0.0


class ObstacleSnapshot(BaseModel):
    id: str
    type: str
    x: float
    y: float
    w: float
    h: float
    vx: float
    lane: int


class GameStatePayload(BaseModel):
    type: Literal["GAME_STATE"] = "GAME_STATE"
    tick: int
    players: list[PlayerSnapshot]
    obstacles: list[ObstacleSnapshot]
    game_over: bool = False

class GameStartedPayload(BaseModel):
    type: Literal["GAME_STARTED"] = "GAME_STARTED"
    room_pin: str

class GameOverPayload(BaseModel):
    type: Literal["GAME_OVER"] = "GAME_OVER"
    room_pin: str