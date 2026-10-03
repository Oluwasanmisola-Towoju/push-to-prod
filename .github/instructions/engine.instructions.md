---
applyTo: "engine/**/*.h,engine/**/*.hpp,engine/**/*.cpp,engine/**/CMakeLists.txt"
---

# Engine conventions (C++17)

## Style
- C++17, everything in `namespace ptp`. Headers use `#pragma once` and include only what they need.
- 4-space indent. `PascalCase` types and files (`GameEngine.cpp`), `camelCase` methods, private members `_leadingUnderscore`, constants `static constexpr` in `UPPER_SNAKE` at namespace scope.
- `enum class` with `UPPER_SNAKE` values. **Append only.** Ordinals are part of the cross-language contract (`PlayerState`: ALIVE=0 DEAD=1 SAFE=2; `ObstacleType`: BUG=0 … SLACK_NOTIFICATION=3).
- `Player` and `Obstacle` are plain data structs with a constructor. Keep behaviour in `GameEngine`.
- RAII only. No raw `new`/`delete`, no globals, no `using namespace` in headers.
- Comments explain *why* (rules, units, invariants), not what the code obviously does.

## Simulation rules
- Units are grid units and seconds. `dt` is in seconds.
- `tick(dt)` clamps `dt` to a maximum of 0.1 s internally. Obstacle speed is up to about 7 units/s, so an unclamped stall would let obstacles tunnel through a 0.8 unit hitbox.
- Player AABB is centered on (x, y). Obstacle `bounds` is min-corner. Any new entity must document which convention it uses.
- Per-tick order is fixed: spawn, move, collide, cull. Do not reorder without a test.
- Randomness comes from a seedable `std::mt19937` member, not `rand()`. The seed is a constructor parameter with a default, so tests are reproducible.
- No exceptions, I/O, logging or sleeping in the tick path. Return state, do not print it.
- The engine is not thread-safe. Document this on the class; do not add locks unless the server changes its threading model.
- Do not add spatial partitioning until a profile shows collision cost above about 2 ms per tick. With 50 players and about 30 obstacles it is roughly 1500 AABB checks.

## Bindings (`pybind_bindings.cpp`)
- Every field Python reads has a `def_readonly`. Every enum has `.value(...)` for each member.
- Keep `py::call_guard<py::gil_scoped_release>()` on `apply_input` and `tick`. This is only safe because the server calls both from the event-loop thread.
- Constructor arguments get `py::arg` names in `snake_case` with defaults matching the C++ defaults.
- Changing a struct returned in `GameState` means updating the bindings **and** the Python serializer in the same change.

## Build
- Target `engine_test` always builds. `-DBUILD_PYBIND=ON` also builds `gameengine` and writes the module to `server/lib` (`.pyd` on Windows, `.so` elsewhere). Do not change that output path.
- MSVC: `cmake --build . --config Release` with no `-j`. Linux and macOS: `cmake --build . -- -j$(nproc)`.

## Tests (`engine/tests/test_main.cpp`)
- Do not use `assert`. Release builds define `NDEBUG` and compile it away, which makes the suite pass vacuously. Use the `CHECK` macro from the `cpp-physics-engine` skill.
- Every rule change has a test that fails without it. Keep tests deterministic by passing a seed.