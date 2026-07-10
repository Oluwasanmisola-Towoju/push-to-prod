import React, { useEffect, useRef } from 'react'

// Must match C++ engine constants to be 10 lanes, 12 grid units wide
const GRID_W = 12;
const GRID_H = 10;

const PLAYER_COLORS = [
  '#58a6ff', '#3fb950', '#f78166', '#d2a8ff',
  '#ffa657', '#79c0ff', '#56d364', '#ff7b72',
]

// Obstacle colours by type index (matches C++ ObstacleType enum order)
const OBS_COLOR = {
  0: '#f85149',  // BUG              — red
  1: '#d29922',  // MERGE_CONFLICT   — amber
  2: '#a371f7',  // SCOPE_CREEP      — purple
  3: '#1f6feb',  // SLACK_NOTIFICATION— blue
}
const OBS_LABEL = ['🐛 BUG', '⚡ CONFLICT', '💀 SCOPE', '📣 SLACK']

export default function GamePage({ pin, initialPlayers, gameStateRef }) {
  const canvasRef = useRef(null)
  // Stable color map for player_id to color string
  const colorMapRef = useRef({})

  // Assign a color to each player the first time we see them
  const getColor = (playerId, index) => {
    if (!colorMapRef.current[playerId]) {
      colorMapRef.current[playerId] =
        PLAYER_COLORS[Object.keys(colorMapRef.current).length % PLAYER_COLORS.length]
    }
    return colorMapRef.current[playerId]
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    let raf

    const drawFrame = () => {
      const W = canvas.width
      const H = canvas.height
      const PAD = 40
      const cellW = (W - PAD * 2) / GRID_W
      const cellH = (H - PAD * 2) / GRID_H

      // Grid canvas coordinate helpers
      // Engine: x=0 is left, y=0 is bottom (start zone), y=GRID_H is top (prod)
      const gx = (x) => PAD + x * cellW
      const gy = (y) => H - PAD - y * cellH   // flip Y axis

      // Background 
      ctx.fillStyle = '#0d1117'
      ctx.fillRect(0, 0, W, H)

      // Lane bands 
      for (let lane = 0; lane < GRID_H; lane++) {
        const top = gy(lane + 1)
        const isStart = lane === 0
        const isProd = lane === GRID_H - 1
        const isDanger = !isStart && !isProd

        ctx.fillStyle = isStart || isProd
          ? '#0a2310'
          : lane % 2 === 0 ? '#0d1117' : '#111820'
        ctx.fillRect(0, top, W, cellH)
      }

      // Grid lines 
      ctx.strokeStyle = '#21262d'
      ctx.lineWidth = 0.5
      for (let x = 0; x <= GRID_W; x++) {
        ctx.beginPath()
        ctx.moveTo(gx(x), PAD)
        ctx.lineTo(gx(x), H - PAD)
        ctx.stroke()
      }
      for (let y = 0; y <= GRID_H; y++) {
        ctx.beginPath()
        ctx.moveTo(PAD, gy(y))
        ctx.lineTo(W - PAD, gy(y))
        ctx.stroke()
      }

      // Zone labels 
      ctx.font = 'bold 11px "SF Mono", monospace'
      ctx.textAlign = 'left'
      ctx.fillStyle = '#3fb950'
      ctx.fillText('▶ START', PAD + 4, H - PAD + 14)
      ctx.fillStyle = '#58a6ff'
      ctx.fillText('★ PROD', PAD + 4, PAD - 6)

      const state = gameStateRef.current

      if (state) {
        if (window.__HOST_GAME_STATE_DEBUG) {
          console.debug('[Host] rendering GAME_STATE', state.tick, state.players?.length)
        }
        // Obstacles 
        for (const obs of state.obstacles) {
          // Determine type from obstacle id suffix (obs_00000 → index 0)
          const typeIndex = parseInt(obs.id.replace('obs_', ''), 10) % 4
          const color = OBS_COLOR[typeIndex]

          const ox = gx(obs.x)
          const oy = gy(obs.y + obs.h)   // top left of obstacle in canvas space
          const ow = obs.w * cellW
          const oh = obs.h * cellH
          const r = Math.min(6, ow * 0.15, oh * 0.3)

          ctx.shadowColor = color
          ctx.shadowBlur = 14
          ctx.fillStyle = color + '28'
          ctx.strokeStyle = color
          ctx.lineWidth = 2

          ctx.beginPath()
          ctx.roundRect(ox, oy, ow, oh, r)
          ctx.fill()
          ctx.stroke()
          ctx.shadowBlur = 0

          // Label scale font to cell size
          const fontSize = Math.max(9, Math.min(13, cellW * 0.35))
          ctx.font = `bold ${fontSize}px "SF Mono", monospace`
          ctx.fillStyle = color
          ctx.textAlign = 'center'
          ctx.fillText(OBS_LABEL[typeIndex], ox + ow / 2, oy + oh / 2 + fontSize * 0.35)
        }

        // Players 
        state.players.forEach((p, i) => {
          const color = getColor(p.player_id, i)
          const cx = gx(p.x)
          const cy = gy(p.y)
          const radius = Math.min(cellW, cellH) * 0.38

          if (!p.is_alive) {
            // Faded X for dead players
            ctx.globalAlpha = 0.25
            ctx.strokeStyle = color
            ctx.lineWidth = 2.5
            ctx.beginPath()
            ctx.moveTo(cx - radius * 0.7, cy - radius * 0.7)
            ctx.lineTo(cx + radius * 0.7, cy + radius * 0.7)
            ctx.moveTo(cx + radius * 0.7, cy - radius * 0.7)
            ctx.lineTo(cx - radius * 0.7, cy + radius * 0.7)
            ctx.stroke()
            ctx.globalAlpha = 1

            // Name below the X
            ctx.fillStyle = color + '66'
            ctx.font = `700 10px "SF Mono", monospace`
            ctx.textAlign = 'center'
            ctx.fillText(p.player_name.slice(0, 7), cx, cy + radius + 13)
            return
          }

          // Outer glow ring
          ctx.shadowColor = color
          ctx.shadowBlur = 22
          ctx.beginPath()
          ctx.arc(cx, cy, radius, 0, Math.PI * 2)
          ctx.fillStyle = color
          ctx.fill()
          ctx.shadowBlur = 0

          // Inner dark circle so name is readable
          ctx.beginPath()
          ctx.arc(cx, cy, radius * 0.72, 0, Math.PI * 2)
          ctx.fillStyle = '#0d1117'
          ctx.fill()

          // Player name
          const fontSize = Math.max(8, Math.min(11, radius * 0.85))
          ctx.fillStyle = color
          ctx.font = `700 ${fontSize}px "SF Mono", monospace`
          ctx.textAlign = 'center'
          ctx.fillText(p.player_name.slice(0, 6), cx, cy + fontSize * 0.38)

          // Score badge above
          if (p.score > 0) {
            ctx.font = `700 10px "SF Mono", monospace`
            ctx.fillStyle = color
            ctx.fillText(`×${p.score}`, cx, cy - radius - 5)
          }
        })

        ctx.textAlign = 'left'
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1

        // Game Over overlay 
        if (state.game_over) {
          ctx.fillStyle = 'rgba(13,17,23,0.75)'
          ctx.fillRect(0, 0, W, H)
          ctx.fillStyle = '#f85149'
          ctx.font = `bold ${Math.min(W * 0.08, 64)}px "SF Mono", monospace`
          ctx.textAlign = 'center'
          ctx.fillText('DEPLOY FAILED', W / 2, H / 2 - 20)
          ctx.fillStyle = '#8b949e'
          ctx.font = `16px "SF Mono", monospace`
          ctx.fillText('returning to lobby...', W / 2, H / 2 + 20)
          ctx.textAlign = 'left'
        }

      } else {
        // Pre-game: show lobby player dots 
        ctx.font = '13px "SF Mono", monospace'
        ctx.fillStyle = '#8b949e'
        ctx.textAlign = 'center'
        ctx.fillText('// waiting for host to start...', W / 2, H / 2 - 40)
        ctx.textAlign = 'left'

        initialPlayers.forEach((p, i) => {
          const color = PLAYER_COLORS[i % PLAYER_COLORS.length]
          const col = i % 8
          const row = Math.floor(i / 8)
          const cx = PAD + (col + 0.5) * cellW
          const cy = H - PAD - (row + 0.5) * cellH

          ctx.shadowColor = color
          ctx.shadowBlur = 16
          ctx.beginPath()
          ctx.arc(cx, cy, cellW * 0.3, 0, Math.PI * 2)
          ctx.fillStyle = color
          ctx.fill()
          ctx.shadowBlur = 0

          ctx.fillStyle = '#0d1117'
          ctx.font = '700 11px "SF Mono", monospace'
          ctx.textAlign = 'center'
          ctx.fillText(p.playerName.slice(0, 6), cx, cy + 4)
          ctx.textAlign = 'left'
        })
      }

      raf = requestAnimationFrame(drawFrame)
    }

    raf = requestAnimationFrame(drawFrame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [initialPlayers, gameStateRef])

  // HUD values to read once per render, not per frame (that's the canvas's job)
  const state = gameStateRef.current
  const aliveCount = state
    ? state.players.filter((p) => p.is_alive).length
    : initialPlayers.length

  return (
    <div style={{ height: '100%', position: 'relative', background: '#0d1117' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />

      {/* Top right HUD */}
      <div style={{
        position: 'absolute', top: 12, right: 16,
        background: 'rgba(13,17,23,0.88)',
        border: '1px solid #30363d',
        borderRadius: '8px',
        padding: '8px 16px',
        fontSize: '13px',
        fontFamily: '"SF Mono", monospace',
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
      }}>
        <span style={{ color: '#8b949e' }}>
          room <span style={{ color: '#58a6ff', fontWeight: 700 }}>{pin}</span>
        </span>
        <span style={{ color: '#3fb950', fontWeight: 600 }}>
          ● {aliveCount} alive
        </span>
        {state && (
          <span style={{ color: '#484f58' }}>
            t{state.tick}
          </span>
        )}
      </div>

      {/* Bottom-left legend */}
      <div style={{
        position: 'absolute', bottom: 12, left: 16,
        background: 'rgba(13,17,23,0.88)',
        border: '1px solid #30363d',
        borderRadius: '8px',
        padding: '7px 14px',
        fontSize: '11px',
        fontFamily: '"SF Mono", monospace',
        display: 'flex',
        gap: '14px',
      }}>
        {Object.entries(OBS_COLOR).map(([idx, color]) => (
          <span key={idx} style={{ color }}>
            ■ {OBS_LABEL[Number(idx)].split(' ')[1]}
          </span>
        ))}
      </div>
    </div>
  )
}