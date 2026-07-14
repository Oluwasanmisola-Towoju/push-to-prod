"""
game loop that ticks the engine 20 times per second and broadcasts the returned GameState to all players in that specific room.
"""

from __future__ import annotations
import asyncio, logging, time

from core.config import TICK_RATE_HZ
from game.room_manager import room_manager, RoomState
from game.connection_manager import connection_manager

logger = logging.getLogger(__name__)
TICK_INTERVAL = 1.0 / TICK_RATE_HZ  # 0.05s at 20HZ

# maps C++ PlayerState enum int values into Python booleans
_DEAD_STATE = 1

def _serialize_state(cpp_state) -> dict:
    players = []
    for p in cpp_state.players:
        players.append({
            "player_id":   p.id,
            "player_name": p.name,
            "x":           round(float(p.x), 3),
            "y":           round(float(p.y), 3),
            "score":       int(p.score),
            "is_alive":    int(p.state) != _DEAD_STATE
        })

    obstacles = []
    for o in cpp_state.obstacles:
        obstacles.append({
            "id":   o.id,
            "x":    round(float(o.bounds.x), 3),
            "y":    round(float(o.bounds.y), 3),
            "w":    round(float(o.bounds.w), 3),
            "h":    round(float(o.bounds.h), 3),
            "vx":   round(float(o.velocityX), 3),
            "lane": int(o.lane),
        })

    return {
        "type":      "GAME_STATE",
        "tick":      int(cpp_state.tick),
        "players":   players,
        "obstacles": obstacles,
        "game_over": bool(cpp_state.game_over)
    }

def _sync_python_state(room, cpp_state) -> None:
    """Mirror C++ positions and scores back into Python Player Objects"""
    for cp in cpp_state.players:
        py_player = room.players.get(cp.id)
        if py_player:
            py_player.x        = float(cp.x)
            py_player.y        = float(cp.y)
            py_player.score    = int(cp.score)
            py_player.is_alive = int(cp.state) != _DEAD_STATE 

async def game_tick_loop() -> None:
    """
    Single long running co-routine, started at server startup.
    Ticks every IN_GAME room at TICK_RATE_HZ
    """
    logger.info(f"[tick] Game loop started at {TICK_RATE_HZ}Hz"
                f" ({TICK_INTERVAL*1000:.0f}ms per tick)")
    last_time = time.monotonic()

    while True:
        await asyncio.sleep(TICK_INTERVAL)

        now          = time.monotonic()
        delta_time   = float(now - last_time)
        last_time    = now

        rooms = room_manager.all_rooms()
        for room in rooms:
            if room.state != RoomState.IN_GAME:
                continue
            if room.engine is None:
                logger.warning(f"[tick] skipping room {room.pin} because engine is None")
                continue

            try:
                cpp_state = room.engine.tick(delta_time)
                _sync_python_state(room, cpp_state)
                payload = _serialize_state(cpp_state)

                await connection_manager.broadcast_to_host(room, payload)
                for player in room.players.values():
                    if player.websocket:
                        await connection_manager.send(player.websocket, payload)

                if cpp_state.game_over:
                    room.state = RoomState.FINISHED
                    await connection_manager.broadcast_to_room(
                        room,
                        {
                            "type": "GAME_OVER",
                            "room_pin": room.pin
                        }
                    )
                    logger.info(f"[tick] Game Over - room {room.pin}")
            except Exception as exc:
                logger.error(f"[tick] Error in room {room.pin}: {exc}", exc_info=True)
