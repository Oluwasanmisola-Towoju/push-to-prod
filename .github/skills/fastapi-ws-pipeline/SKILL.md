---
name: fastapi-ws-pipeline
description: Procedures for extending the Push to Prod FastAPI WebSocket pipeline. Use when adding an inbound or outbound message, fixing broadcast or reconnect behaviour, separating connection state from game state, slimming per-player traffic, or load-testing the tick loop with simulated players.
---

# FastAPI WebSocket pipeline

Every change here must keep payloads compliant with P1 to P12 in `.github/copilot-instructions.md`.

## 1. Add an inbound message (client to server)

1. Define it in `server/models/messages.py`:

```python
class UsePowerupPayload(BaseModel):
    type: Literal["USE_POWERUP"]
    player_id: str
    powerup: Literal["SHIELD"]
```

2. Add a branch in `routers/ws/player_ws.py`. Validate, then delegate:

```python
elif msg_type == "USE_POWERUP":
    if not player or not room or room.state != RoomState.IN_GAME:
        continue
    try:
        msg = UsePowerupPayload.model_validate(data)
    except ValidationError as exc:
        await connection_manager.send(
            websocket, ErrorPayload(code="INVALID_PAYLOAD", message=str(exc.errors()[0]["msg"]))
        )
        continue
    if room.engine is not None:
        room.engine.use_powerup(player.player_id, msg.powerup)   # exists only after the C++ change
```

3. Write an integration test: success path, and a malformed payload that returns `ERROR` with `INVALID_PAYLOAD`.
4. Add the row to the README protocol table (P12). Report the Contract delta.

## 2. Add an outbound message

Create a model with a default `type`, send it through `connection_manager`, and test its ordering relative to its neighbours (P9). If it is per-player, send it to that player's socket only (P10).

## 3. Separate connection state from game state

This fixes README sharp edge 1, where dead players stop receiving frames and `GAME_OVER` never reaches anyone.

```python
# game/room_manager.py
@dataclass
class Player:
    player_id: str
    player_name: str
    websocket: Optional[WebSocket]
    is_alive: bool = True       # game state, set only from the engine snapshot
    connected: bool = True      # transport state, set only by ws handlers
    score: int = 0
    x: float = 6.0
    y: float = 0.0
```

```python
# game/connection_manager.py, in broadcast_to_players
if not player.connected or not player.websocket or player.websocket == exclude_ws:
    continue
try:
    await player.websocket.send_text(data)
except Exception as e:
    logger.warning("send to player %s failed: %s", player_id, e)
    player.connected = False       # not is_alive
    player.websocket = None
```

In `player_ws.py`, on disconnect set `connected = False` and `websocket = None`. In `reconnect_player`, set `connected = True`. Add a test: the last player dies, and that player still receives `GAME_OVER`.

## 4. Slim per-player traffic

Phones only need their own status. Keep full `GAME_STATE` for the host and send phones a small message only on change.

```python
class PlayerStatusPayload(BaseModel):
    type: Literal["PLAYER_STATUS"] = "PLAYER_STATUS"
    player_id: str
    is_alive: bool
    score: int
```

```python
# Room gets: last_status: dict[str, tuple[bool, int]] = field(default_factory=dict)
for cp in players:                               # `players = cpp_state.players` read once
    key = (int(cp.state) != _DEAD_STATE, int(cp.score))
    if room.last_status.get(cp.id) == key:
        continue
    room.last_status[cp.id] = key
    p = room.players.get(cp.id)
    if p and p.connected and p.websocket:
        await connection_manager.send(
            p.websocket, PlayerStatusPayload(player_id=cp.id, is_alive=key[0], score=key[1])
        )
```

The client reads `PLAYER_STATUS` instead of filtering `GAME_STATE`. Update the controller handler and the README protocol table.

## 5. Serialize new engine fields

In `_serialise_state`, convert enums with a single table and keep the key snake_case:

```python
_OBSTACLE_NAMES = {0: "BUG", 1: "MERGE_CONFLICT", 2: "SCOPE_CREEP", 3: "SLACK_NOTIFICATION"}
...
"type": _OBSTACLE_NAMES.get(int(o.type), "BUG"),
```

Add the new field to `GameStatePayload` so the documented schema matches what is sent.

## 6. Soak test with 50 simulated players

Save as `tests/soak_test.py` and run it with the server up (`uvicorn main:app --port 8000`).

```python
import asyncio, json, random, statistics, time
import websockets

BASE = "ws://127.0.0.1:8000"
ACTIONS = ["MOVE_UP", "MOVE_LEFT", "MOVE_RIGHT", "MOVE_DOWN"]


async def bot(pin, name, stop):
    async with websockets.connect(f"{BASE}/ws/player") as ws:
        await ws.send(json.dumps({"type": "JOIN_ROOM", "room_pin": pin, "player_name": name}))
        pid = json.loads(await ws.recv())["player_id"]

        async def drain():
            async for _ in ws:
                pass
        reader = asyncio.create_task(drain())
        while not stop.is_set():
            await ws.send(json.dumps({"type": "PLAYER_INPUT", "player_id": pid,
                                      "action": random.choice(ACTIONS)}))
            await asyncio.sleep(0.25)
        reader.cancel()


async def main(n=50, seconds=30):
    async with websockets.connect(f"{BASE}/ws/host") as host:
        await host.send(json.dumps({"type": "CREATE_ROOM"}))
        pin = json.loads(await host.recv())["room_pin"]
        stop = asyncio.Event()
        bots = [asyncio.create_task(bot(pin, f"bot{i}", stop)) for i in range(n)]
        joined = 0
        while joined < n:
            if json.loads(await host.recv())["type"] == "PLAYER_JOINED":
                joined += 1
        await host.send(json.dumps({"type": "START_GAME", "room_pin": pin}))
        gaps, last, end = [], None, time.monotonic() + seconds
        while time.monotonic() < end:
            msg = json.loads(await host.recv())
            if msg["type"] == "GAME_STATE":
                now = time.monotonic()
                if last:
                    gaps.append((now - last) * 1000)
                last = now
            elif msg["type"] == "GAME_OVER":
                break
        stop.set()
        await asyncio.gather(*bots, return_exceptions=True)
        if gaps:
            p95 = sorted(gaps)[int(len(gaps) * 0.95)]
            print(f"ticks={len(gaps)} mean={statistics.mean(gaps):.1f}ms p95={p95:.1f}ms")

asyncio.run(main())
```

Targets: mean close to 50 ms and p95 under 80 ms. If p95 climbs, check for repeated `cpp_state.*` attribute access, per-player `await` fan-out, and log volume. Bots die quickly, so a short run is normal; raise `seconds` and lower difficulty for longer soaks.

## 7. Checklist
Integration tests pass. Contract delta written. README table updated. No engine call off the event-loop thread. No broadcast filtered on `is_alive`.