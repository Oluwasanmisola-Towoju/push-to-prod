---
applyTo: "frontend/**/*.js,frontend/**/*.jsx"
---

# Frontend conventions (React 18/19 + Three.js)

## Language and style
- ES modules and function components with hooks only. No class components.
- 2-space indent, single quotes, no semicolons in new code. Do not reformat unrelated lines in existing files.
- Components `PascalCase.jsx`, hooks `useThing.js`, utilities `camelCase.js`. One default export per component file.
- Prefer small hooks over large components. Inline styles are the house style; keep colour values in a shared palette object, not scattered hex strings.
- Palette: bg `#0d1117`, panel `#161b22`, border `#30363d`, text `#e6edf3`, muted `#8b949e`, blue `#58a6ff`, green `#3fb950`, red `#f85149`, amber `#d29922`, purple `#a371f7`.

## WebSocket client
- Raw `WebSocket` only. Do not add `socket.io-client`.
- URL: `import.meta.env.VITE_WS_URL` or `${scheme}://${window.location.hostname}:8000`, where `scheme` is `wss` when `window.location.protocol === 'https:'`.
- The `send` helper returns a boolean. If it returns `false`, queue the message (see `pendingJoin` in the client `App.jsx`) rather than dropping it.
- Keep the latest `onMessage` in a ref so reconnects do not re-run on callback identity changes.
- Phone reconnect uses exponential backoff 1 s to 16 s and `sessionStorage` key `ptp_player`. The host does not reconnect; a host drop destroys the room.
- Never throw inside `onmessage`. Parse in `try/catch` and ignore unknown `type` values.

## Wire to state
- The wire is snake_case (P2). Convert to camelCase in one mapping function in `handleMessage`.
- `GAME_STATE` is **not** mapped and **not** put in React state. It goes into a ref (`gameStateRef.current = payload`) and is read by the animation loop (P11).
- Read new fields with defaults: `p.lives ?? 1` (P6).

## Three.js
- One `WebGLRenderer`, created in `useEffect`, fully cleaned up on unmount: `cancelAnimationFrame`, remove listeners, remove the canvas, `renderer.dispose()`.
- Never call `setState` from the animation loop.
- Meshes are pooled by server id (`player_id`, obstacle `id`): create on first sight, update the transform on later frames, remove and dispose when the id disappears.
- All engine-to-world conversion goes through one `toWorld(x, y)` helper. Engine `y` (lane, forward) maps to Three.js `z`. Three.js `y` is height. Rendered hitboxes must match engine AABBs: players are centered on (x, y), obstacle bounds are min-corner.
- Obstacle visuals come from a style table keyed by the string `type` (`BUG`, `MERGE_CONFLICT`, `SCOPE_CREEP`, `SLACK_NOTIFICATION`). Do not derive type from the id.
- No per-frame allocations: reuse `Vector3`, `Color`, and shared geometries. Cache geometries by size.
- Budget: under 150 draw calls and 60 fps with 50 players and 30 obstacles. Use `InstancedMesh` past that. One shadow-casting directional light at most.
- Text and HUD are React DOM overlays on top of the canvas. Do not render text in WebGL unless you use CSS2DRenderer for name labels.

## Controller
- `ControllerPage` accepts input only while the player is alive. Swipe, d-pad, keyboard and gamepad all call the same `onAction(action)` with one of the five action strings.
- Do not send `PLAYER_INPUT` unless the player has a `player_id` and the game state is `in_game`.
- Gamepad polling fires on edge changes only, never continuously.

## Testing
`npm run lint` in `frontend/` and `npm run build` in each app must pass. For renderer work, drive the scene from the mock harness in the skill instead of needing a live server.