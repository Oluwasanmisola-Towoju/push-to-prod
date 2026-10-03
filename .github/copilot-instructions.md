# Copilot instructions: Push to Prod

Real-time multiplayer game: **C++ simulation, Python FastAPI network layer, React + Three.js renderer.** Read this file fully before editing. Language-specific rules are in `.github/instructions/`, procedures are in `.github/skills/`, and specialists are in `.github/agents/`. The full architecture write-up with diagrams is in `README.md`.

## 1. Architecture map

```text
phone (React)                 server (FastAPI, one asyncio loop)                 host (React + Three.js)
 swipe/dpad/key/pad            ┌────────────────────────────────────────────┐      ┌───────────────────┐
  └─ PLAYER_INPUT ──────────▶ │ routers/ws/player_ws.py                    │      │ useHostSocket      │
                              │   validate ─▶ room.engine.apply_input()    │      │  └─ gameStateRef   │
                              │ game/tick_loop.py (20 Hz)                  │      │ GamePage (rAF)     │
                              │   engine.tick(dt) ─▶ GameState (C++)       │      │  └─ meshes by id   │
                              │   _sync_python_state / _serialise_state    │      └───────────────────┘
                              │ game/connection_manager.py ── GAME_STATE ─▶ /ws/host ─────────┘
                              └────────────────────────────────────────────┘
                                         ▲ pybind11 (server/lib/gameengine.*)
                                         │
                              engine/src: GameEngine, Player.h, Obstacle.h
```

| Concern | Owner | Rule |
|---|---|---|
| Movement, spawning, collisions, scoring, game-over | `engine/` (C++) | Only place these exist |
| Rooms, PINs, sockets, validation, tick clock, serialization | `server/` (Python) | Never reimplements simulation |
| Rendering, HUD, input capture | `frontend/` (JS) | Never simulates, never predicts |

## 2. Real-time sync model

The server is authoritative. Inputs are **event-driven** (one `PLAYER_INPUT` per action). State is **clocked**: `game_tick_loop` runs at `TICK_RATE_HZ` (20), calls `engine.tick(dt)` with measured `dt`, and broadcasts a full `GAME_STATE` snapshot. Snapshots are idempotent, so a lost frame is replaced by the next. The host writes snapshots to a ref, not React state. The engine is **not thread-safe**: call it only from the event-loop thread. Never push it into an executor or thread without adding a mutex in C++.

## 3. Data flow: player state and collisions

`PLAYER_INPUT` goes to `player_ws.py`, which validates the action and calls `engine.apply_input`. Every 50 ms `tick_loop` calls `engine.tick(dt)`: spawn, move, `_checkCollisions` (AABB, marks `PlayerState::DEAD`), cull. pybind11 returns a `GameState`. `_sync_python_state` mirrors it into Python `Player` dataclasses and `_serialise_state` builds the JSON. `connection_manager` broadcasts it, `useHostSocket` parses it, `App.handleMessage` stores it in `gameStateRef`, and `GamePage` renders it. Collisions are decided in C++ only. If you are writing collision or movement logic outside `engine/`, stop.

## 4. Cross-language contracts

Coordinates: grid units, `x` left to right, `y` bottom to top (lane 0 = START, `y == laneCount` = PROD). Player AABB is centered on (x, y); obstacle `bounds` is min-corner (x, y, w, h). Defaults: 10 lanes, 12 columns, 50 players max, 4-digit PIN. Enum ordinals are frozen: `PlayerState` ALIVE=0 DEAD=1 SAFE=2; `ObstacleType` BUG=0 MERGE_CONFLICT=1 SCOPE_CREEP=2 SLACK_NOTIFICATION=3. Append new values only.

## 5. Payload formatting rules

Cite these by number in reviews. Violating them breaks the WebSocket pipeline.

**P1. Flat envelope.** One JSON object per frame, `type` as the first key. No nested `payload`, no root arrays, no batching several messages into one frame.

**P2. Naming.** `type` is SCREAMING_SNAKE_CASE. Every other key is snake_case on the wire, in both directions. camelCase exists only in React state, produced in one mapping function.

**P3. Value types.** Ints are ints. Floats are rounded to 3 decimals in Python before sending. Booleans are JSON `true`/`false`, never 0/1. `null` only for genuinely absent optionals. Never emit `NaN` or `Infinity` (invalid JSON).

**P4. Identifiers are opaque strings.** `room_pin` is a 4-character digit string with leading zeros, never an int. `player_id` is a UUID4 string. Obstacle `id` is `obs_%05d`. Clients must not parse ids to derive meaning.

**P5. Enums cross as strings.** The serializer maps C++ ordinals to names in a single table. JS never sees ordinals.

**P6. Additive evolution only.** Add optional fields. Never rename, remove or retype a live field. JS reads new fields with a default (`p.lives ?? 1`). Unknown `type` or unknown fields are ignored, not errors.

**P7. Validate at the edge.** Every inbound message has a Pydantic model with a `Literal` type. The engine only receives whitelisted strings. Cap lengths (`player_name` ≤ 20).

**P8. Outbound through models.** Every outbound message except the `GAME_STATE` hot path has a Pydantic model with a default `type`. `GAME_STATE` may be built as a dict but must match `GameStatePayload`. Send only through `connection_manager`, never `websocket.send_*` directly in a router.

**P9. Ordering invariants.** `JOIN_ACK` reaches the joiner before any `PLAYER_JOINED`. `GAME_STARTED` precedes the first `GAME_STATE`. The final `GAME_STATE` (with `game_over: true`) precedes `GAME_OVER`. A reconnecting player gets `JOIN_ACK` before any state.

**P10. Rate and size.** Inputs are event-driven (no polling loops). `GAME_STATE` is at most `TICK_RATE_HZ`, with a 12 KB budget at 50 players and about 30 obstacles. Static data goes in `GAME_STARTED`, not every tick. Data for one player goes to that player, not fanned out to everyone.

**P11. Hot path on the client.** `GAME_STATE` goes into a ref only. Rare messages (`JOIN_ACK`, `GAME_STARTED`, `GAME_OVER`, `ERROR`) may update React state.

**P12. One change, four places.** Any new or changed message updates, in the same PR: `server/models/messages.py`, the protocol table in `README.md`, an integration test in `tests/integration_test.py`, and the JS handler.

Bad and good:

```jsonc
// BAD: nested payload, camelCase, numeric enum, int pin, bool as 0/1
{ "type": "gameState", "payload": { "roomPin": 1234, "players": [{ "isAlive": 1, "state": 1 }] } }

// GOOD
{ "type": "GAME_STATE", "tick": 88, "players": [{ "player_id": "…", "is_alive": false, "x": 6.0, "y": 2.0, "score": 1 }],
  "obstacles": [{ "id": "obs_00004", "type": "BUG", "x": 3.1, "y": 2.0, "w": 1.5, "h": 0.9, "vx": 4.2, "lane": 2 }],
  "game_over": false }
```

## 6. Cross-stack feature injection

Work inside-out and finish each layer before starting the next. Each layer is its own commit.

1. **Write the contract first.** Put the final JSON for every new or changed message in the PR description. Check it against P1 to P12.
2. **C++.** Add the state and rules in `engine/src`, add a deterministic test, run the engine tests.
3. **Binding.** Expose new fields with `def_readonly` in `pybind_bindings.cpp`. Rebuild with `-DBUILD_PYBIND=ON`.
4. **Python.** Update `models/messages.py`, the router branch if inbound, `_serialise_state` (with enum mapping), and add an integration test.
5. **JS.** Map the message in `handleMessage`, update the renderer or HUD, handle the field being absent.
6. **Run `./dev.sh`.** It builds, tests and starts everything. Play one real round on a phone.
7. **Report a Contract delta** (the JSON added or changed) so the next agent or reviewer can verify it.

Worked example, adding `lives`:

```cpp
// Player.h
int lives = 1;
// pybind_bindings.cpp
.def_readonly("lives", &Player::lives)
```
```python
# tick_loop._serialise_state
"lives": int(p.lives),
```
```js
// GamePage / HUD
const lives = p.lives ?? 1   // P6: tolerate older servers
```

## 7. Conventions at a glance

| | Python | C++ | JavaScript |
|---|---|---|---|
| Version | 3.13, `from __future__ import annotations` | C++17, namespace `ptp` | ES modules, React function components |
| Style | 4 spaces, 100 cols, type hints on all public functions | 4 spaces, `#pragma once` | 2 spaces, single quotes, no semicolons in new code |
| Names | `snake_case`, `PascalCase` classes, `UPPER_SNAKE` constants | `PascalCase` types, `camelCase` methods, `_private` members, `UPPER_SNAKE` constexpr | `camelCase`, `PascalCase` components, `useX` hooks |
| Logging | `logging.getLogger(__name__)`, never `print` | None in hot path | `console.debug` only behind a flag |
| Errors | Typed `ErrorPayload` with a `code` | No exceptions in the tick path | Never throw inside `onmessage` |

Details are in `.github/instructions/`.

## 8. Commands

```bash
./dev.sh                                        # build, test, run everything
cd engine/build && cmake -DBUILD_PYBIND=ON .. && cmake --build . --config Release   # no -j on MSVC
python tests/integration_test.py                # protocol tests
cd frontend && npm run lint
```

## 9. Hard stops

- Never add collision, movement or scoring logic outside `engine/`.
- Never call the engine from a thread or executor.
- Never introduce `socket.io` (it is installed but unused; the protocol is raw WebSocket).
- Never read env vars outside `server/core/config.py`.
- Never reorder or renumber an existing enum.
- Never filter broadcasts on `is_alive` (see README sharp edge 1).
- Never rely on `assert` in engine tests; use `CHECK`.
- Never put a secret, token or PIN in a log line.

## 10. Agents

`@cpp-engine` for `engine/`, `@fastapi-backend` for `server/`, `@threejs-frontend` for `frontend/`. For a cross-stack feature, start with `@cpp-engine` and follow the handoffs. Each agent ends with a Contract delta.