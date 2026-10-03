import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useHudSnapshot } from '../hooks/useHudSnapshot.js'
import { disposeObject, styleFor } from '../rendererUtils.js'

const GRID_W = 12
const GRID_H = 10
const PLAYER_COLORS_HEX = [
  0x58a6ff, 0x3fb950, 0xf78166, 0xd2a8ff,
  0xffa657, 0x79c0ff, 0x56d364, 0xff7b72,
]

const toWorld = (x, y) => ({ x, y: 0, z: y })

function makeDeadMarker(color) {
  const material = new THREE.LineBasicMaterial({ color })
  const points = [
    [new THREE.Vector3(-0.3, 0.05, -0.3), new THREE.Vector3(0.3, 0.05, 0.3)],
    [new THREE.Vector3(0.3, 0.05, -0.3), new THREE.Vector3(-0.3, 0.05, 0.3)],
  ]
  const group = new THREE.Group()
  points.forEach((line) => {
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(line), material))
  })
  return group
}

export default function GamePage({ pin, initialPlayers, gameStateRef }) {
  const mountRef = useRef(null)
  const colorMapRef = useRef({})
  const hud = useHudSnapshot(gameStateRef, 250)

  const getPlayerColor = (playerId) => {
    if (!colorMapRef.current[playerId]) {
      const index = Object.keys(colorMapRef.current).length
      colorMapRef.current[playerId] =
        new THREE.Color(PLAYER_COLORS_HEX[index % PLAYER_COLORS_HEX.length])
    }
    return colorMapRef.current[playerId]
  }

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return undefined

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setClearColor(0x0d1117)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(0x0d1117, 30, 60)
    const camera = new THREE.PerspectiveCamera(
      50, mount.clientWidth / mount.clientHeight, 0.1, 100
    )
    camera.position.set(GRID_W / 2, 18, 14)
    camera.lookAt(GRID_W / 2, 0, GRID_H / 2)

    scene.add(new THREE.AmbientLight(0x1a2030, 3))
    const dirLight = new THREE.DirectionalLight(0xffffff, 2)
    dirLight.position.set(GRID_W / 2, 12, GRID_H)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.set(2048, 2048)
    dirLight.shadow.camera.left = -20
    dirLight.shadow.camera.right = 20
    dirLight.shadow.camera.top = 20
    dirLight.shadow.camera.bottom = -20
    scene.add(dirLight)
    const fillLight = new THREE.PointLight(0x58a6ff, 0.8, 30)
    fillLight.position.set(GRID_W / 2, -2, GRID_H / 2)
    scene.add(fillLight)

    const floorMat = new THREE.MeshStandardMaterial({ color: 0x0d1117, roughness: 0.9, metalness: 0.1 })
    for (let lane = 0; lane < GRID_H; lane++) {
      const color = lane === 0 || lane === GRID_H - 1
        ? 0x0a2310
        : (lane % 2 === 0 ? 0x0d1117 : 0x111820)
      const material = floorMat.clone()
      material.color = new THREE.Color(color)
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(GRID_W, 0.1, 1), material)
      mesh.position.set(GRID_W / 2, -0.05, lane + 0.5)
      mesh.receiveShadow = true
      scene.add(mesh)
    }

    const lineMat = new THREE.LineBasicMaterial({ color: 0x21262d })
    for (let x = 0; x <= GRID_W; x++) {
      scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, 0, 0), new THREE.Vector3(x, 0, GRID_H),
        ]), lineMat
      ))
    }
    for (let z = 0; z <= GRID_H; z++) {
      scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, z), new THREE.Vector3(GRID_W, 0, z),
        ]), lineMat
      ))
    }

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

    const shieldGeometry = new THREE.SphereGeometry(0.6, 16, 12)
    shieldGeometry.userData.shared = true
    const playerMeshes = {}
    const obstacleMeshes = {}

    function makePlayerMesh(color) {
      const group = new THREE.Group()
      const bodyMaterial = new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: 0.4, roughness: 0.3, metalness: 0.6,
      })
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.55, 12), bodyMaterial)
      body.castShadow = true
      group.add(body)
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.38, 0.04, 8, 24),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2 })
      )
      ring.rotation.x = Math.PI / 2
      ring.position.y = -0.28
      group.add(ring)
      const shieldMaterial = new THREE.MeshBasicMaterial({
        color: 0x58a6ff, transparent: true, opacity: 0.48, wireframe: true,
      })
      const shield = new THREE.Mesh(shieldGeometry, shieldMaterial)
      shield.visible = false
      group.add(shield)
      return { group, shield }
    }

    function makeObstacleMesh(obs) {
      const style = styleFor(obs.type)
      const group = new THREE.Group()
      if (obs.type === 'ESPRESSO_SHOT') {
        const radius = Math.min(obs.w, obs.h) / 2
        const body = new THREE.Mesh(
          new THREE.CylinderGeometry(radius, radius * 0.86, Math.min(obs.w, obs.h) * 0.7, 16),
          new THREE.MeshStandardMaterial({
            color: style.color, emissive: style.color, emissiveIntensity: 1.1,
            roughness: 0.25, metalness: 0.35,
          })
        )
        body.castShadow = true
        group.add(body)
      } else {
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(obs.w, 0.7, obs.h),
          new THREE.MeshStandardMaterial({
            color: style.color, emissive: style.color, emissiveIntensity: 0.3,
            roughness: 0.4, metalness: 0.5, transparent: true, opacity: 0.88,
          })
        )
        body.castShadow = true
        group.add(body)
        group.add(new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(obs.w, 0.7, obs.h)),
          new THREE.LineBasicMaterial({ color: style.color })
        ))
      }
      return group
    }

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', onResize)
    let raf
    let frameCount = 0

    const animate = () => {
      raf = requestAnimationFrame(animate)
      frameCount++
      const state = gameStateRef.current
      if (state) {
        const activeObsIds = new Set((state.obstacles ?? []).map((obstacle) => obstacle.id))
        Object.keys(obstacleMeshes).forEach((id) => {
          if (!activeObsIds.has(id)) {
            scene.remove(obstacleMeshes[id])
            disposeObject(obstacleMeshes[id])
            delete obstacleMeshes[id]
          }
        })
        ;(state.obstacles ?? []).forEach((obs) => {
          if (!obstacleMeshes[obs.id]) {
            obstacleMeshes[obs.id] = makeObstacleMesh(obs)
            scene.add(obstacleMeshes[obs.id])
          }
          const mesh = obstacleMeshes[obs.id]
          const center = toWorld(obs.x + obs.w / 2, obs.y + obs.h / 2)
          mesh.position.set(center.x, 0.35, center.z)
          if (obs.type === 'ESPRESSO_SHOT') {
            mesh.rotation.y += 0.035
            mesh.position.y = 0.35 + Math.sin(frameCount * 0.08 + obs.x) * 0.08
            mesh.children[0].material.emissiveIntensity =
              0.8 + (Math.sin(frameCount * 0.12) + 1) * 0.35
          }
        })

        const activePlayerIds = new Set((state.players ?? []).map((player) => player.player_id))
        Object.keys(playerMeshes).forEach((id) => {
          if (!activePlayerIds.has(id)) {
            scene.remove(playerMeshes[id].group)
            disposeObject(playerMeshes[id].group)
            delete playerMeshes[id]
          }
        })
        ;(state.players ?? []).forEach((p) => {
          if (!playerMeshes[p.player_id]) {
            const color = getPlayerColor(p.player_id)
            const avatar = makePlayerMesh(color)
            avatar.dead = makeDeadMarker(color)
            avatar.dead.visible = false
            scene.add(avatar.group)
            scene.add(avatar.dead)
            playerMeshes[p.player_id] = avatar
          }
          const avatar = playerMeshes[p.player_id]
          const world = toWorld(p.x + 0.5, p.y + 0.5)
          avatar.shield.visible = p.is_alive && (p.is_invulnerable ?? false)
          avatar.shield.material.opacity = (p.invulnerable_for ?? 0) < 2
            ? (Math.sin(frameCount * 0.35) > 0 ? 0.12 : 0.65)
            : 0.48
          if (p.is_alive) {
            avatar.group.visible = true
            avatar.dead.visible = false
            avatar.group.position.set(world.x, 0.28 + Math.sin(frameCount * 0.08 + p.x) * 0.04, world.z)
            avatar.group.rotation.y += 0.02
          } else {
            avatar.group.visible = false
            avatar.dead.visible = true
            avatar.dead.position.set(world.x, 0, world.z)
          }
        })
      } else {
        initialPlayers.forEach((p, i) => {
          const id = `lobby_${i}`
          if (!playerMeshes[id]) {
            const avatar = makePlayerMesh(new THREE.Color(PLAYER_COLORS_HEX[i % PLAYER_COLORS_HEX.length]))
            scene.add(avatar.group)
            playerMeshes[id] = avatar
          }
          const col = i % 8
          const row = Math.floor(i / 8)
          playerMeshes[id].group.position.set(
            1.5 + col * 1.3, 0.5 + Math.sin(frameCount * 0.05 + i) * 0.15, 2 + row * 1.5
          )
          playerMeshes[id].group.rotation.y += 0.01
        })
      }
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      Object.values(obstacleMeshes).forEach((mesh) => disposeObject(mesh))
      Object.values(playerMeshes).forEach((avatar) => {
        disposeObject(avatar.group)
        if (avatar.dead) disposeObject(avatar.dead)
      })
      shieldGeometry.dispose()
      disposeObject(scene)
      mount.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, [gameStateRef, initialPlayers])

  const aliveCount = hud.players.filter((player) => player.alive).length
  return (
    <div style={{ height: '100%', position: 'relative', background: '#0d1117' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      <div style={{
        position: 'absolute', top: 8, left: 16, right: 16, display: 'flex',
        justifyContent: 'space-between', alignItems: 'flex-start', pointerEvents: 'none',
      }}>
        <div style={{ color: '#58a6ff', fontSize: 12, fontWeight: 700 }}>★ PROD</div>
        <div style={{
          background: 'rgba(13,17,23,0.9)', border: '1px solid #30363d',
          borderRadius: 8, padding: '8px 12px', minWidth: 260,
          fontSize: 12, fontFamily: '"SF Mono","Fira Code","Consolas",monospace',
        }}>
          <div style={{ color: '#8b949e', marginBottom: 4 }}>
            room <span style={{ color: '#58a6ff', fontWeight: 700 }}>{pin}</span>
            <span style={{ float: 'right' }}>{aliveCount} alive · t{hud.tick}</span>
          </div>
          {hud.players.map((player) => (
            <div key={player.id} style={{
              display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10,
              color: player.alive ? '#e6edf3' : '#8b949e', padding: '2px 0',
            }}>
              <span>{player.name}</span>
              <span style={{ color: '#d29922' }}>⚡ {player.stamina}</span>
              <span style={{ color: player.shield ? '#58a6ff' : '#484f58' }}>
                {player.shield ? '◉' : '○'} {player.alive ? 'ALIVE' : 'DEAD'}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div style={{
        position: 'absolute', bottom: 12, left: 16, color: '#8b949e',
        fontSize: 11, fontFamily: '"SF Mono","Fira Code","Consolas",monospace',
      }}>
        <span style={{ color: '#3fb950' }}>▶ START</span>
        <span style={{ marginLeft: 14 }}>● {aliveCount} alive</span>
      </div>
      {hud.gameOver && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(13,17,23,0.82)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#f85149', fontSize: 'clamp(32px,6vw,72px)', fontWeight: 800,
          fontFamily: '"SF Mono","Fira Code","Consolas",monospace',
        }}>
          DEPLOY FAILED
        </div>
      )}
    </div>
  )
}
