export const meta = {
  name: "add_espresso_shot",
  description: "Adds the Espresso Shot power-up across C++, FastAPI and Three.js, one layer at a time, with a gate between layers."
};

const FENCE = "`".repeat(3);

const asText = (r) => (typeof r === "string" ? r : r?.text ?? r?.output ?? JSON.stringify(r));

function lastJsonBlock(reply, label) {
  const re = new RegExp(FENCE + "json\\s*([\\s\\S]*?)" + FENCE, "g");
  const blocks = [...asText(reply).matchAll(re)];
  if (!blocks.length) throw new Error(`${label}: reply had no JSON block`);
  try {
    return JSON.parse(blocks[blocks.length - 1][1]);
  } catch (e) {
    throw new Error(`${label}: contract is not valid JSON (${e.message})`);
  }
}

function passed(reply) {
  const marks = asText(reply).match(/RESULT:\s*(PASS|FAIL)/g);
  return Boolean(marks) && /PASS/.test(marks[marks.length - 1]);
}

function need(obj, paths, label) {
  for (const p of paths) {
    const v = p.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
    if (v === undefined) throw new Error(`${label}: contract is missing "${p}"`);
  }
}

const SHARED = `
First read .github/copilot-instructions.md and your own instructions file, and follow payload rules P1 to P12.
Stay inside your own layer. Run the checks in your task and fix what they find before you reply.
Commit your layer on its own with a conventional commit message.
Do not run ./dev.sh. It starts servers and never exits.
End your reply with exactly two things and nothing after them: a ${FENCE}json code fence holding one JSON object (the contract described in your task), then a last line reading RESULT: PASS or RESULT: FAIL followed by a short reason.
`;

async function gated(name, label, task) {
  let reply = asText(await agent(name, SHARED + task));
  if (passed(reply)) return reply;
  log(`${label}: failed its gate, one repair pass`);
  reply = asText(await agent(name, SHARED + `
Your previous attempt ended like this:
${reply.slice(-1500)}
Fix whatever failed, re-run the checks, and reply in the same format.
` + task));
  if (!passed(reply)) throw new Error(`${label}: still failing after repair, stopping before the next layer`);
  return reply;
}

export default async function run() {
  phase("Step 1: C++ simulation (engine)");
  const engineReply = await gated("cpp-engine", "engine", `
Implement the Espresso Shot power-up. Edit engine/ only.

1. Data. Append ESPRESSO_SHOT (ordinal 4) to ObstacleType in Obstacle.h and add the matching .value line to the ObstacleType binding in pybind_bindings.cpp. Add int stamina = 100 and float invulnerableTimer = 0.0f to Player (camelCase in C++), bound with def_readonly as "stamina" and "invulnerable_timer". Add bool consumed = false to Obstacle, not exposed to Python.
2. Tick order. Clamp dt to 0.1 at the top of tick, add it to a new float member _elapsed, then run: spawn, decrement every player's invulnerableTimer by dt (floor at 0), move, collide, cull. Cull removes off-screen obstacles and any obstacle with consumed == true.
3. Collisions, per living player. First pass over pickups (type ESPRESSO_SHOT, not consumed) that intersect: set consumed = true, stamina += 50, invulnerableTimer = 10.0f (assign, never add, so pickups cannot stack past 10 s). Second pass over every other obstacle that intersects: if invulnerableTimer <= 0 the player becomes DEAD and you stop checking that player. A pickup must never kill. A pickup taken by one player is skipped for the rest of that tick.
4. Spawning. Do not use _tickCount * dt, because dt varies per tick. Add _nextEspressoAt, set once in the constructor to a value between 4 and 9 seconds. When _elapsed >= _nextEspressoAt spawn exactly one pickup, then set _nextEspressoAt = _elapsed + 20.0f. The pickup uses a random lane from 1 to laneCount - 1, speed 2.0 units/s in a random direction (slow enough to be catchable), w = 0.8, h = OBSTACLE_H, the same start-x rule as other obstacles, and an id from the shared counter. In _spawnObstacle capture const int seq = _nextObstacleId++ once and derive both the id and the type from seq; today the type comes from the already-incremented counter, so it is off by one.
5. Tests. Declare friend struct EngineTestAccess in GameEngine.h and define it in test_main.cpp so tests can place players and obstacles directly. assert is compiled out in Release and the build is Release, so the current tests verify nothing: add the CHECK macro from the cpp-physics-engine skill and convert every assert. Required cases: a pickup appears within 10 s of simulated time; collecting one gives stamina 150 and a timer within 0.05 of 10.0; an invulnerable player survives a lethal obstacle and a normal player dies; a pickup alone never kills; the timer reaches 0 and never goes below, after which the same obstacle kills; a consumed pickup is absent from the next snapshot; tick(5.0f) moves nothing further than a 0.1 s tick would.
6. Build and verify from engine/build: cmake -DBUILD_PYBIND=ON .., then cmake --build . --config Release (no -j on MSVC), then run the engine tests (./Release/engine_test.exe on Windows). Then, from server/, import gameengine with sys.path.insert(0, 'lib') and print stamina and invulnerable_timer for a fresh player.
7. Commit as feat(engine): add espresso shot power-up.

Contract: one JSON object shaped like {"player": {"stamina": 150, "invulnerable_timer": 9.95}, "obstacle": {"type": 4, "name": "ESPRESSO_SHOT"}}.
`);
  const engineContract = lastJsonBlock(engineReply, "engine");
  need(engineContract, ["player.stamina", "player.invulnerable_timer", "obstacle.type"], "engine");
  log("Engine done. Contract:", JSON.stringify(engineContract));

  phase("Step 2: Python network layer (FastAPI)");
  const backendReply = await gated("fastapi-backend", "backend", `
The engine now exposes this:
${JSON.stringify(engineContract, null, 2)}

Edit server/, tests/ and the README protocol section only.

1. models/messages.py. GameStatePayload.players is list[dict], which documents nothing. Add PlayerSnapshot (player_id, player_name, x, y, score, is_alive, stamina: int = 100, is_invulnerable: bool = False, invulnerable_for: float = 0.0) and ObstacleSnapshot (id, type: str, x, y, w, h, vx, lane), and use them in GameStatePayload. The defaults keep older senders valid (P6).
2. game/tick_loop.py. Add a module-level _OBSTACLE_NAMES = {0: "BUG", 1: "MERGE_CONFLICT", 2: "SCOPE_CREEP", 3: "SLACK_NOTIFICATION", 4: "ESPRESSO_SHOT"}. Obstacles currently carry no type at all, so the host guesses it from the id. Emit "type": _OBSTACLE_NAMES.get(int(o.type), "UNKNOWN") on every obstacle (P5).
3. In _serialise_state read cpp_state.players and cpp_state.obstacles once each into locals. Per player add "stamina": int(p.stamina), "is_invulnerable": float(p.invulnerable_timer) > 0.0, and "invulnerable_for": round(max(0.0, float(p.invulnerable_timer)), 3).
4. tests/integration_test.py. Add a test that starts a game and collects GAME_STATE for up to 12 seconds using recv_type. Every obstacle must have a string type from the known set, every player an int stamina, a bool is_invulnerable and a float invulnerable_for, and at least one ESPRESSO_SHOT must show up (the engine schedules one in the first 9 seconds).
5. README.md. Update the GAME_STATE sample and the protocol table (P12).
6. Verify with python tests/integration_test.py.
7. Commit as feat(server): serialize espresso shot state.

Contract: the exact GAME_STATE JSON the frontend will receive, with one player and one ESPRESSO_SHOT obstacle in it.
`);
  const backendContract = lastJsonBlock(backendReply, "backend");
  need(backendContract, ["players.0.stamina", "players.0.is_invulnerable", "players.0.invulnerable_for", "obstacles.0.type"], "backend");
  log("Backend done. Contract:", JSON.stringify(backendContract));

  phase("Step 3: JS presentation layer (Three.js)");
  await gated("threejs-frontend", "frontend", `
The server now broadcasts this GAME_STATE and you may rely on nothing beyond it:
${JSON.stringify(backendContract, null, 2)}

Edit frontend/host only.

1. Read GamePage.jsx first. If obstacle colour or label is still derived from the id (parseInt of obs.id) or an index, replace that with a lookup on obs.type in an OBSTACLE_STYLES table (BUG, MERGE_CONFLICT, SCOPE_CREEP, SLACK_NOTIFICATION, ESPRESSO_SHOT) with a FALLBACK_STYLE for unknown strings. Create the table if it does not exist.
2. ESPRESSO_SHOT uses colour 0x3fb950, but do not draw it as a box. Draw a short cylinder, spinning and bobbing with a pulsing emissive, so a pickup never reads as a hazard. Size and position it from obs.w and obs.h as a min-corner AABB, like every other obstacle.
3. Shield. When p.is_invulnerable (default false) show a wireframe sphere of radius 0.6 on that player's pooled group. Create it lazily once per player and toggle .visible. Never create or destroy it per frame. Share one SphereGeometry marked userData.shared = true and dispose it on unmount. Dispose the shield material when the player id leaves the snapshot, using disposeObject from the threejs-host-renderer skill. When p.invulnerable_for (default 0) is below 2, blink the shield so players see it expiring.
4. HUD. The HUD currently reads gameStateRef.current during React render, so it only refreshes when something else triggers a render. Add a hook useHudSnapshot(gameStateRef, 250) that copies a small summary from the ref into state at 4 Hz, and only when a value changed. Show the top 8 players by score with name, stamina (default 100), a shield dot while invulnerable, and alive or dead. Do not list all 50.
5. Keep GAME_STATE in the ref, no setState in the animation loop, and all engine-to-world conversion through one toWorld helper.
6. Extend or create the dev/mockState.js harness so ?mock=1 shows one pickup and one invulnerable player.
7. Verify with npm run lint in frontend/ and npm run build in frontend/host. Say plainly in your reply which parts you could not check visually.
8. Commit as feat(frontend): render espresso shot and shield.

Contract: {"reads": [...]} listing every GAME_STATE field you now depend on.
`);

  log("Espresso Shot is in across C++, Python and JS, and each layer is its own commit.");
  log("Now play one real round: run ./dev.sh, join from a phone, find the green cup in the first 10 s, grab it, and drive into a hazard while the shield is up.");
}