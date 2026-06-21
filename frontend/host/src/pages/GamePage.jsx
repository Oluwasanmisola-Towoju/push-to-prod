import React, { useEffect, useRef } from 'react'

export default function GamePage({ players, pin }) {
  const canvasRef = useRef(null)

  // store the latest players array in a mutable ref so animation loop will read only the newewst data without triggering 
  // react re-render for the useEffect
  const playersRef = useRef(players)
  useEffect(() => {
    playersRef.current = players
  }, [players])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const resize = () => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const colors = ['#58a6ff','#3fb950','#f78166','#d2a8ff','#ffa657']
    let frame = 0
    let raf

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#0d1117'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Placeholder grid lines to serve for future lane system
      ctx.strokeStyle = '#161b22'
      ctx.lineWidth = 1
      for (let y = 60; y < canvas.height; y += 60) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(canvas.width, y)
        ctx.stroke()
      }

      ctx.fillStyle = '#21262d'
      ctx.font = '600 13px "SF Mono", monospace'
      ctx.fillText('// Three.js scene mounts here later on..', 20, 30)

      // Animate players as bouncing dots using Ref not props
      const currentPlayers = playersRef.current;
      currentPlayers.forEach((p, i) => {
        const cols = Math.min(players.length, 8)
        const col  = i % cols
        const row  = Math.floor(i / cols)
        const x    = 80 + col * 100
        const y    = 100 + row * 100 + Math.sin(frame * 0.05 + i) * 12
        const color = colors[i % colors.length]

        // Glow effect
        ctx.shadowColor = color
        ctx.shadowBlur  = 16
        ctx.beginPath()
        ctx.arc(x, y, 22, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
        ctx.shadowBlur = 0

        ctx.fillStyle   = '#0d1117'
        ctx.font        = '700 11px "SF Mono", monospace'
        ctx.textAlign   = 'center'
        ctx.fillText(p.playerName.slice(0, 7), x, y + 4)
        ctx.textAlign   = 'left'
      })

      frame++
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
      {/* HUD overlay */}
      <div style={{
        position: 'absolute',
        top: '12px',
        right: '16px',
        background: 'rgba(13,17,23,0.85)',
        border: '1px solid #30363d',
        borderRadius: '8px',
        padding: '8px 14px',
        fontSize: '13px',
        color: '#8b949e',
      }}>
        room <span style={{ color: '#58a6ff' }}>{pin}</span>
        &nbsp;·&nbsp;
        <span style={{ color: '#3fb950' }}>{players.length}</span> alive
      </div>
    </div>
  )
}