---
name: threejs-host-renderer
description: Procedures for improving the Push to Prod Three.js host scene. Use when adding obstacle or player visuals, smoothing 20 Hz server snapshots to 60 fps, pooling and disposing meshes, adding bloom post-processing, or testing the renderer without a live server.
---

# Three.js host renderer

The host receives a full `GAME_STATE` about every 50 ms. The renderer's job is to look continuous at 60 fps, stay inside a performance budget, and never invent game logic.

## 1. Test without a server (mock harness)

Create `frontend/host/src/dev/mockState.js` and feed it into `gameStateRef` when the URL has `?mock=1`. This lets you iterate on visuals without Python or C++.

```js
const TYPES = ['BUG', 'MERGE_CONFLICT', 'SCOPE_CREEP', 'SLACK_NOTIFICATION']

export function makeMockState(tick) {
  const t = tick / 20
  return {
    type: 'GAME_STATE', tick, game_over: false,
    players: [
      { player_id: 'mock-1', player_name: 'mock', x: 6, y: t % 10, score: 0, is_alive: true },
      { player_id: 'mock-2', player_name: 'ghost', x: 3, y: 2, score: 1, is_alive: false },
    ],
    obstacles: TYPES.map((type, i) => ({
      id: `obs_${String(i).padStart(5, '0')}`, type,
      x: ((t * 4 + i * 3) % 16) - 2, y: i + 1, w: 1.5, h: 0.9, vx: 4, lane: i + 1,
    })),
  }
}
```

```js
// in host App.jsx, once
useEffect(() => {
  if (!new URLSearchParams(location.search).has('mock')) return
  let tick = 0
  const id = setInterval(() => { gameStateRef.current = makeMockState(tick++) }, 50)
  return () => clearInterval(id)
}, [])
```

## 2. Add a new obstacle visual

1. Confirm the server sends the new `type` string (P5). If it does not, hand off to `@fastapi-backend` and `@cpp-engine`.
2. Add an entry to the style table, not a new `if` branch:

```js
export const OBSTACLE_STYLES = {
  BUG:                { color: 0xf85149, label: 'BUG' },
  MERGE_CONFLICT:     { color: 0xd29922, label: 'CONFLICT' },
  SCOPE_CREEP:        { color: 0xa371f7, label: 'SCOPE' },
  SLACK_NOTIFICATION: { color: 0x1f6feb, label: 'SLACK' },
  // new types go here
}
const FALLBACK_STYLE = { color: 0x8b949e, label: '?' }
const styleFor = (type) => OBSTACLE_STYLES[type] ?? FALLBACK_STYLE   // never crash on unknown types
```

3. Build the mesh from `obs.w` and `obs.h`, not constants. Position it from the min-corner AABB: centre = (x + w/2, y + h/2).
4. Check it in mock mode, then in a real round.

## 3. Smooth 20 Hz to 60 fps

Keep `gameStateRef` as is, and add a second ref that holds the last two snapshots:

```js
// host App.jsx, in the GAME_STATE case
case 'GAME_STATE':
  gameStateRef.current = payload
  snapshotRef.current = {
    prev: snapshotRef.current?.curr ?? payload,
    curr: payload,
    receivedAt: performance.now(),
  }
  break
```

```js
// renderer, each frame
const TICK_MS = 1000 / 20
const snap = snapshotRef.current
if (snap) {
  const alpha = Math.min((performance.now() - snap.receivedAt) / TICK_MS, 1)
  const prevById = new Map(snap.prev.players.map((p) => [p.player_id, p]))
  for (const p of snap.curr.players) {
    const a = prevById.get(p.player_id) ?? p
    const x = a.x + (p.x - a.x) * alpha
    const y = a.y + (p.y - a.y) * alpha
    // apply toWorld(x, y) to the pooled mesh
  }
  // obstacles move at constant velocity, so extrapolate instead of interpolating
  const dtSec = Math.min((performance.now() - snap.receivedAt) / 1000, 0.1)
  // x = o.x + o.vx * dtSec
}
```

Rendering is one tick behind, which is invisible and removes stutter. Do not lerp across a player's score-reset teleport (`y` dropping from 9 to 0); if `Math.abs(p.y - a.y) > 2`, snap.

## 4. Pool and dispose

```js
export function disposeObject(root) {
  root.traverse((n) => {
    if (n.geometry && !n.geometry.userData.shared) n.geometry.dispose()
    const mats = Array.isArray(n.material) ? n.material : [n.material]
    mats.forEach((m) => m && m.dispose())
  })
}
```

Mark cached geometries with `geometry.userData.shared = true` so they are disposed once, on unmount, not per obstacle. When an id leaves the snapshot: `scene.remove(group); disposeObject(group); delete pool[id]`.

## 5. Bloom with the `postprocessing` package

```js
import { EffectComposer, RenderPass, EffectPass, BloomEffect } from 'postprocessing'

const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
composer.addPass(new EffectPass(camera, new BloomEffect({
  intensity: 1.1, luminanceThreshold: 0.35, mipmapBlur: true,
})))
// on resize: composer.setSize(w, h)
// in the loop: composer.render()  (replaces renderer.render)
// on unmount: composer.dispose()
```

Drive glow with `emissiveIntensity` on materials, not extra lights. Keep bloom off if the frame time exceeds 14 ms on the projector laptop.

## 5b. Performance budget
Draw calls under 150, no allocations inside the loop, one directional shadow light, `InstancedMesh` for obstacles past about 100. Check with `renderer.info.render.calls` while 50 mock players are on screen.

## 6. Checklist before finishing
Mock mode shows the change. Real round shows the change. No `setState` in the loop. Disposal verified (`renderer.info.memory.geometries` stays flat over 60 s). Absent fields tolerated. Report a Contract delta.