---
applyTo: "server/**/*.py,tests/**/*.py"
---

# Backend conventions (Python 3.13, FastAPI, Pydantic v2)

## Style
- Run from `server/` as the working directory, so imports are `core.config`, `game.room_manager`, `routers.ws.player_ws`, `models.messages`.
- Start every module with `from __future__ import annotations`. Type-hint all public functions. 4 spaces, 100 columns.
- `snake_case` functions and variables, `PascalCase` classes and Pydantic models, `UPPER_SNAKE` constants.
- Use `logging.getLogger(__name__)`. No `print` (the engine-load message in `room_manager` is the one legacy exception). Use lazy `%s` formatting in hot paths.
- Use the `lifespan` context manager in `main.py`. Do not add `@app.on_event`.

## Layering
- Routers in `routers/ws/` are thin: parse, validate, delegate. Logic lives in `game/`.
- `core/config.py` is the only module that reads environment variables.
- `room_manager` and `connection_manager` are module-level singletons. Do not instantiate new ones.
- Send only through `connection_manager.send` or `broadcast_*`. Never call `websocket.send_text` from a router.

## Messages (see P1 to P12)
- Inbound: a Pydantic model with `type: Literal[...]` in `models/messages.py`, validated with `Model.model_validate(data)`. On `ValidationError` reply `ErrorPayload(code="INVALID_PAYLOAD", message=...)` and continue; never crash the socket loop.
- Outbound: a Pydantic model with a default `type`; serialize with `model_dump_json()`. `GAME_STATE` is built as a dict for speed and must match `GameStatePayload`.
- Whitelist `action` against the five known strings before the engine sees it. Strip and cap `player_name` at 20 characters.
- Leave `room_pin` as a string everywhere.

## Engine bridge
- Import the native module once, in `game/room_manager.py`, with a graceful fallback when it is missing.
- Call the engine only from the event-loop thread. It is not thread-safe, and pybind releases the GIL around `apply_input` and `tick`, so an executor would race.
- In the tick loop, read each vector attribute (`cpp_state.players`, `cpp_state.obstacles`) **once** into a local. Every attribute access copies the whole list across the boundary.
- Do not clamp or reshape simulation values in Python. The engine owns `dt` sanity (see the engine instructions).
- Map C++ enums to strings in one table in `tick_loop.py` (P5). Never send ordinals.
- `is_alive` is game state and is set only from the engine snapshot. Add a separate `connected` flag for transport state. Never filter broadcasts on `is_alive`.

## Errors and lifecycle
- Catch `WebSocketDisconnect` at the router level and mark the player disconnected without removing them (reconnect depends on it).
- A host disconnect destroys the room and notifies players with `HOST_DISCONNECTED`.
- Exceptions inside the tick loop are logged per room with `exc_info=True` and must not stop the loop for other rooms.
- Never log tokens, or full JSON frames above debug level.

## Tests
- `tests/integration_test.py` boots uvicorn on port 18766 in a thread and uses `websockets`. Each message type needs a test for the success path and one error path.
- Write assertions with the existing `record(label, ok, detail)` helper, and use `recv_type` to skip unrelated frames when waiting for a specific message.
- Check the message ordering invariants (P9) in tests, not only content.