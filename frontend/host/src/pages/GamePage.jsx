import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'

// ── Grid constants — must match C++ engine ────────────────────────────────────
const GRID_W = 12
const GRID_H = 10

// ── Dev-theme palette ─────────────────────────────────────────────────────────
const PLAYER_COLORS_HEX = [
  0x58a6ff, 0x3fb950, 0xf78166, 0xd2a8ff,
  0xffa657, 0x79c0ff, 0x56d364, 0xff7b72,
]
const OBS_COLORS_HEX = {
  0: 0xf85149,  // BUG            — red
  1: 0xd29922,  // MERGE_CONFLICT — amber
  2: 0xa371f7,  // SCOPE_CREEP    — purple
  3: 0x1f6feb,  // SLACK          — blue
}
const OBS_LABELS = ['🐛 BUG', '⚡ CONFLICT', '💀 SCOPE', '📣 SLACK']

// Camera position  
const CAM_X = GRID_W / 2
const CAM_Y = 18
const CAM_Z = 14

export default function GamePage({ pin, initialPlayers, gameStateRef }) {
  const mountRef    = useRef(null)
  const sceneRef    = useRef(null)
  const colorMapRef = useRef({})   // player_id to THREE.Color

  const getPlayerColor = (playerId) => {
    if (!colorMapRef.current[playerId]) {
      const idx = Object.keys(colorMapRef.current).length
      colorMapRef.current[playerId] =
        new THREE.Color(PLAYER_COLORS_HEX[idx % PLAYER_COLORS_HEX.length])
    }
    return colorMapRef.current[playerId]
  }

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    // Renderer 
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setClearColor(0x0d1117)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type    = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)

    // Scene 
    const scene = new THREE.Scene()
    scene.fog   = new THREE.Fog(0x0d1117, 30, 60)
    sceneRef.current = scene

    // Camera 
    const camera = new THREE.PerspectiveCamera(
      50,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100
    )
    camera.position.set(CAM_X, CAM_Y, CAM_Z)
    camera.lookAt(CAM_X, 0, GRID_H / 2)

    // Lighting 
    scene.add(new THREE.AmbientLight(0x1a2030, 3))

    const dirLight = new THREE.DirectionalLight(0xffffff, 2)
    dirLight.position.set(GRID_W / 2, 12, GRID_H)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.set(2048, 2048)
    dirLight.shadow.camera.left   = -20
    dirLight.shadow.camera.right  =  20
    dirLight.shadow.camera.top    =  20
    dirLight.shadow.camera.bottom = -20
    scene.add(dirLight)

    // Subtle fill light from below to lift the dark tones
    const fillLight = new THREE.PointLight(0x58a6ff, 0.8, 30)
    fillLight.position.set(GRID_W / 2, -2, GRID_H / 2)
    scene.add(fillLight)

    // Grid floor 
    const floorMat = new THREE.MeshStandardMaterial({
      color:     0x0d1117,
      roughness: 0.9,
      metalness: 0.1,
    })

    for (let lane = 0; lane < GRID_H; lane++) {
      const isStart = lane === 0
      const isProd  = lane === GRID_H - 1
      const color   = isStart || isProd ? 0x0a2310 : (lane % 2 === 0 ? 0x0d1117 : 0x111820)

      const geo  = new THREE.BoxGeometry(GRID_W, 0.1, 1)
      const mat  = floorMat.clone()
      mat.color  = new THREE.Color(color)
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(GRID_W / 2, -0.05, lane + 0.5)
      mesh.receiveShadow = true
      scene.add(mesh)
    }

    // Grid lines  
    const lineMat = new THREE.LineBasicMaterial({ color: 0x21262d })
    for (let x = 0; x <= GRID_W; x++) {
      const geo  = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, 0, 0),
        new THREE.Vector3(x, 0, GRID_H),
      ])
      scene.add(new THREE.Line(geo, lineMat))
    }
    for (let z = 0; z <= GRID_H; z++) {
      const geo  = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, z),
        new THREE.Vector3(GRID_W, 0, z),
      ])
      scene.add(new THREE.Line(geo, lineMat))
    }

    // START / PROD zone glow strips 
    const startStrip = new THREE.Mesh(
      new THREE.BoxGeometry(GRID_W, 0.05, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x3fb950, emissive: 0x3fb950, emissiveIntensity: 1.5 })
    )
    startStrip.position.set(GRID_W / 2, 0.05, 0)
    scene.add(startStrip)

    const prodStrip = new THREE.Mesh(
      new THREE.BoxGeometry(GRID_W, 0.05, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x58a6ff, emissive: 0x58a6ff, emissiveIntensity: 1.5 })
    )
    prodStrip.position.set(GRID_W / 2, 0.05, GRID_H)
    scene.add(prodStrip)

    // Mutable mesh pools 
    // reuse meshes by id to avoid creating/destroying geometry every frame
    const playerMeshes   = {}   // player_id → { body, ring, dead }
    const obstacleMeshes = {}   // obs id → mesh group

    // Helper to build a player avatar group 
    function makePlayerMesh(color) {
      const group = new THREE.Group()

      // Body — cylinder
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.32, 0.55, 12),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.4,
          roughness: 0.3,
          metalness: 0.6,
        })
      )
      body.castShadow = true
      group.add(body)

      // Glow ring at base
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.38, 0.04, 8, 24),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 2,
        })
      )
      ring.rotation.x = Math.PI / 2
      ring.position.y = -0.28
      group.add(ring)

      return group
    }

    // Helper to build an obstacle mesh group 
    function makeObstacleMesh(typeIndex, w) {
      const color = new THREE.Color(OBS_COLORS_HEX[typeIndex] || 0xf85149)
      const group = new THREE.Group()

      const body = new THREE.Mesh(
        new THREE.BoxGeometry(w, 0.7, 0.85),
        new THREE.MeshStandardMaterial({
          color,
          emissive:           color,
          emissiveIntensity:  0.3,
          roughness:          0.4,
          metalness:          0.5,
          transparent:        true,
          opacity:            0.88,
        })
      )
      body.castShadow = true
      group.add(body)

      // Glowing edge lines
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(w, 0.7, 0.85)),
        new THREE.LineBasicMaterial({ color, linewidth: 1.5 })
      )
      group.add(edges)

      return group
    }

    // Dead marker (flat X on the floor) 
    function makeDeadMarker(color) {
      const mat   = new THREE.LineBasicMaterial({ color })
      const pts1  = [new THREE.Vector3(-0.3, 0.05, -0.3), new THREE.Vector3(0.3, 0.05, 0.3)]
      const pts2  = [new THREE.Vector3(0.3, 0.05, -0.3), new THREE.Vector3(-0.3, 0.05, 0.3)]
      const group = new THREE.Group()
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts1), mat))
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts2), mat))
      return group
    }

    // Resize handler 
    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', onResize)

    // Animation loop 
    let raf
    let frameCount = 0

    const animate = () => {
      raf = requestAnimationFrame(animate)
      frameCount++

      const state = gameStateRef.current

      if (state) {
        // Sync obstacle meshes 
        const activeObsIds = new Set(state.obstacles.map(o => o.id))

        // Remove stale obstacle meshes
        for (const id of Object.keys(obstacleMeshes)) {
          if (!activeObsIds.has(id)) {
            scene.remove(obstacleMeshes[id])
            delete obstacleMeshes[id]
          }
        }

        // Add or update obstacles
        for (const obs of state.obstacles) {
          const typeIndex = parseInt(obs.id.replace('obs_', ''), 10) % 4

          if (!obstacleMeshes[obs.id]) {
            const mesh = makeObstacleMesh(typeIndex, obs.w)
            scene.add(mesh)
            obstacleMeshes[obs.id] = mesh
          }

          const mesh = obstacleMeshes[obs.id]
          // Engine x is column, y is lane (z in 3D), centre the mesh on the cell
          mesh.position.set(
            obs.x + obs.w / 2,
            0.35,
            obs.y + obs.h / 2
          )
        }

        // Sync player meshes 
        const activePlayerIds = new Set(state.players.map(p => p.player_id))

        for (const id of Object.keys(playerMeshes)) {
          if (!activePlayerIds.has(id)) {
            scene.remove(playerMeshes[id].group)
            delete playerMeshes[id]
          }
        }

        for (const p of state.players) {
          const color = getPlayerColor(p.player_id)

          if (!playerMeshes[p.player_id]) {
            const group = makePlayerMesh(color)
            const dead  = makeDeadMarker(color)
            dead.visible = false
            scene.add(group)
            scene.add(dead)
            playerMeshes[p.player_id] = { group, dead }
          }

          const { group, dead } = playerMeshes[p.player_id]

          if (p.is_alive) {
            group.visible = true
            dead.visible  = false
            // Engine: x=column, y=lane → 3D: x=column+0.5, z=lane+0.5
            group.position.set(p.x + 0.5, 0.28, p.y + 0.5)
            // Gentle bob
            group.position.y = 0.28 + Math.sin(frameCount * 0.08 + p.x) * 0.04
            // Slow rotation
            group.rotation.y += 0.02
          } else {
            group.visible = false
            dead.visible  = true
            dead.position.set(p.x + 0.5, 0, p.y + 0.5)
          }
        }

        //  Game over overlay handled via React HUD below 

      } else {
        // Pre-game: animate lobby players as floating orbs
        initialPlayers.forEach((p, i) => {
          const color = new THREE.Color(PLAYER_COLORS_HEX[i % PLAYER_COLORS_HEX.length])
          const id    = `lobby_${i}`

          if (!playerMeshes[id]) {
            const group = makePlayerMesh(color)
            scene.add(group)
            playerMeshes[id] = { group, dead: new THREE.Group() }
          }

          const col = i % 8
          const row = Math.floor(i / 8)
          const m   = playerMeshes[id].group
          m.position.set(
            1.5 + col * 1.3,
            0.5 + Math.sin(frameCount * 0.05 + i) * 0.15,
            2 + row * 1.5
          )
          m.rotation.y += 0.01
        })
      }

      renderer.render(scene, camera)
    }

    animate()

    // Cleanup 
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      mount.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, [initialPlayers, gameStateRef])

  const state      = gameStateRef.current
  const aliveCount = state
    ? state.players.filter(p => p.is_alive).length
    : initialPlayers.length

  return (
    <div style={{ height: '100%', position: 'relative', background: '#0d1117' }}>

      {/* Three.js mounts here */}
      <div
        ref={mountRef}
        style={{ width: '100%', height: '100%' }}
      />

      {/* Top-right HUD */}
      <div style={{
        position:   'absolute',
        top:        12,
        right:      16,
        background: 'rgba(13,17,23,0.88)',
        border:     '1px solid #30363d',
        borderRadius: '8px',
        padding:    '8px 16px',
        fontSize:   '13px',
        fontFamily: '"SF Mono","Fira Code","Consolas",monospace',
        display:    'flex',
        gap:        '16px',
        alignItems: 'center',
      }}>
        <span style={{ color: '#8b949e' }}>
          room <span style={{ color: '#58a6ff', fontWeight: 700 }}>{pin}</span>
        </span>
        <span style={{ color: '#3fb950', fontWeight: 600 }}>
          ● {aliveCount} alive
        </span>
        {state && (
          <span style={{ color: '#484f58' }}>t{state.tick}</span>
        )}
      </div>

      {/* Bottom-left legend */}
      <div style={{
        position:   'absolute',
        bottom:     12,
        left:       16,
        background: 'rgba(13,17,23,0.88)',
        border:     '1px solid #30363d',
        borderRadius: '8px',
        padding:    '7px 14px',
        fontSize:   '11px',
        fontFamily: '"SF Mono","Fira Code","Consolas",monospace',
        display:    'flex',
        gap:        '14px',
      }}>
        {[
          ['#f85149','BUG'],
          ['#d29922','CONFLICT'],
          ['#a371f7','SCOPE CREEP'],
          ['#1f6feb','SLACK'],
        ].map(([c, l]) => (
          <span key={l} style={{ color: c }}>■ {l}</span>
        ))}
      </div>

      {/* Zone labels */}
      <div style={{
        position:   'absolute',
        top:        12,
        left:       16,
        fontFamily: '"SF Mono","Fira Code","Consolas",monospace',
        display:    'flex',
        flexDirection: 'column',
        gap:        '4px',
      }}>
        <span style={{ color: '#58a6ff', fontSize: '12px', fontWeight: 700 }}>
          ★ PROD
        </span>
      </div>
      <div style={{
        position:   'absolute',
        bottom:     44,
        left:       16,
        fontFamily: '"SF Mono","Fira Code","Consolas",monospace',
      }}>
        <span style={{ color: '#3fb950', fontSize: '12px', fontWeight: 700 }}>
          ▶ START
        </span>
      </div>

      {/* GAME OVER overlay */}
      {state?.game_over && (
        <div style={{
          position:       'absolute',
          inset:          0,
          background:     'rgba(13,17,23,0.82)',
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            '16px',
        }}>
          <div style={{
            color:      '#f85149',
            fontSize:   'clamp(32px,6vw,72px)',
            fontWeight: 800,
            fontFamily: '"SF Mono","Fira Code","Consolas",monospace',
            letterSpacing: '-1px',
          }}>
            DEPLOY FAILED
          </div>
          <div style={{
            color:      '#8b949e',
            fontSize:   '16px',
            fontFamily: '"SF Mono","Fira Code","Consolas",monospace',
          }}>
            returning to lobby...
          </div>
          {/* Scoreboard */}
          {state.players.length > 0 && (
            <div style={{
              background:   '#161b22',
              border:       '1px solid #30363d',
              borderRadius: '10px',
              padding:      '16px 24px',
              minWidth:     '240px',
              marginTop:    '8px',
            }}>
              {[...state.players]
                .sort((a, b) => b.score - a.score)
                .map((p, i) => (
                  <div key={p.player_id} style={{
                    display:        'flex',
                    justifyContent: 'space-between',
                    padding:        '6px 0',
                    borderBottom:   i < state.players.length - 1 ? '1px solid #21262d' : 'none',
                    fontFamily:     '"SF Mono","Fira Code","Consolas",monospace',
                    fontSize:       '14px',
                    color:          p.is_alive ? '#3fb950' : '#8b949e',
                  }}>
                    <span>{i + 1}. {p.player_name}</span>
                    <span style={{ color: '#58a6ff' }}>×{p.score}</span>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      )}

      {/* Pre-game waiting overlay */}
      {!state && (
        <div style={{
          position:   'absolute',
          top:        '50%',
          left:       '50%',
          transform:  'translate(-50%,-50%)',
          color:      '#8b949e',
          fontFamily: '"SF Mono","Fira Code","Consolas",monospace',
          fontSize:   '14px',
          pointerEvents: 'none',
        }}>
          // waiting for host to start...
        </div>
      )}
    </div>
  )
}