---
name: cpp-physics-engine
description: Procedures for evolving the Push to Prod C++ game engine. Use when adding obstacle types or mechanics, fixing obstacle id/type mismatches, writing Release-safe tests, making simulation deterministic with a seeded RNG, clamping dt, adding pybind11 bindings, or building on Windows and Linux.
---

# C++ physics engine

The engine decides movement, collisions, scoring and game-over. Keep it dependency-free and deterministic.

## 1. Release-safe tests

`assert` is compiled out in Release, and `dev.sh` builds Release. Replace it with this macro at the top of `engine/tests/test_main.cpp`:

```cpp
#include <cstdlib>
#include <iostream>

#define CHECK(cond)                                                          \
    do {                                                                     \
        if (!(cond)) {                                                       \
            std::cerr << "[FAIL] " #cond "  (" << __FILE__ << ":" << __LINE__ \
                      << ")\n";                                              \
            std::exit(1);                                                    \
        }                                                                    \
    } while (0)
```

Then change every `assert(x)` to `CHECK(x)`. Run the suite once with a deliberately wrong expectation to confirm it fails.

## 2. Seeded, deterministic randomness

Replace `rand()` with a member generator.

```cpp
// GameEngine.h
#include <random>
explicit GameEngine(int laneCount = 10, int gridWidth = 12, unsigned seed = 0xC0FFEE);
// private:
std::mt19937 _rng;
```

```cpp
// GameEngine.cpp
GameEngine::GameEngine(int laneCount, int gridWidth, unsigned seed)
    : _laneCount(laneCount), _gridWidth(gridWidth), _tickCount(0)
    , _spawnTimer(0.0f), _spawnInterval(1.2f), _rng(seed) {}

// usage: std::uniform_int_distribution<int>(1, _laneCount - 1)(_rng)
```

In the binding, accept the seed: `.def(py::init<int, int, unsigned>(), py::arg("lane_count") = 10, py::arg("grid_width") = 12, py::arg("seed") = 0xC0FFEE)`. Add a replay test:

```cpp
void test_deterministic_replay() {
    GameEngine a(10, 12, 42), b(10, 12, 42);
    a.addPlayer("p", "x"); b.addPlayer("p", "x");
    GameState sa, sb;
    for (int i = 0; i < 400; ++i) { sa = a.tick(0.05f); sb = b.tick(0.05f); }
    CHECK(sa.obstacles.size() == sb.obstacles.size());
    for (size_t i = 0; i < sa.obstacles.size(); ++i)
        CHECK(sa.obstacles[i].bounds.x == sb.obstacles[i].bounds.x);
}
```

## 3. Clamp dt

At the start of `tick`:

```cpp
static constexpr float MAX_DT = 0.1f;
deltaTime = std::min(deltaTime, MAX_DT);
```

Test: a single `tick(5.0f)` must not teleport an obstacle more than `MAX_DT * maxSpeed` units.

## 4. Fix the obstacle id/type mismatch

The current spawn code increments `_nextObstacleId` while building the id, then derives the type from the already-incremented counter, so the type is `(id+1) % 4`. Capture the sequence once:

```cpp
const int seq = _nextObstacleId++;
std::ostringstream ss;
ss << "obs_" << std::setw(5) << std::setfill('0') << seq;
const auto type = static_cast<ObstacleType>(seq % OBSTACLE_TYPE_COUNT);
```

Add `static constexpr int OBSTACLE_TYPE_COUNT = 4;` next to the other constants, and a test that the nth spawned obstacle has `type == n % 4`.

## 5. Add a new obstacle type end to end

1. **`Obstacle.h`**: append to `ObstacleType` (for example `FLAKY_TEST`). Never insert in the middle.
2. **`GameEngine.cpp`**: bump `OBSTACLE_TYPE_COUNT`; give the type its own width, speed or behaviour inside `_spawnObstacle` or a small helper, not a long `if` chain.
3. **Bindings**: add `.value("FLAKY_TEST", ObstacleType::FLAKY_TEST)` to the `ObstacleType` enum binding.
4. **Test**: `CHECK` that spawned obstacles include the new type and that its rule (speed, width) holds.
5. **Hand off** to `@fastapi-backend`: extend `_OBSTACLE_NAMES` in `tick_loop.py` with `4: "FLAKY_TEST"`.
6. **Hand off** to `@threejs-frontend`: add the entry to `OBSTACLE_STYLES`.
7. Write the Contract delta: the new `type` string value in `GAME_STATE.obstacles[]`.

## 6. Add a new player field

Add the field to `Player` with a default, bind it with `def_readonly`, update `tick_loop._serialise_state`, and have the JS read it with a default (`?? fallback`). Existing clients must keep working (P6).

## 7. Build and test

| Platform | Configure | Build | Run tests |
|---|---|---|---|
| Windows (MSVC, Git Bash) | `cmake -DBUILD_PYBIND=ON ..` | `cmake --build . --config Release` (no `-j`) | `./Release/engine_test.exe` |
| Linux / macOS | `cmake -DBUILD_PYBIND=ON -DCMAKE_BUILD_TYPE=Release ..` | `cmake --build . -- -j$(nproc)` | `./engine_test` |

Run from `engine/build`. The module lands in `server/lib` (for example `gameengine.cp313-win_amd64.pyd`). Smoke test from `server/`:

```bash
python -c "import sys; sys.path.insert(0,'lib'); import gameengine as g; e=g.GameEngine(10,12); e.add_player('a','A'); e.apply_input('a','MOVE_UP'); print(e.tick(0.05).players[0].y)"
```

Expected output: `1.0`.

## 8. Boundary cost

pybind11 with `stl.h` copies a whole vector into a new Python list on every attribute access. If profiling shows `tick_loop` marshalling dominates, the fix is on this side: add a `GameEngine::snapshot()` binding that returns plain Python dicts in one pass, then have the server call it once per tick. Measure first.

## 9. Checklist
`CHECK` tests pass in Release. Enum changes are append-only. Bindings updated. Module imports from `server/lib`. Contract delta written, and handoffs made for the server serializer and the renderer.