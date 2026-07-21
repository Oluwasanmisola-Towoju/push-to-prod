import React, { useEffect, useState } from 'react'
import QRDisplay from '../components/QRDisplay.jsx'

// Rotating dev-themed flavor text shown while waiting
const LOBBY_LINES = [
  '// initialising chaos engine...',
  '// warming up the spaghetti...',
  '// spinning up merge conflicts...',
  '// seeding random bugs...',
  '// allocating scope creep...',
  '// scheduling Slack distractions...',
  '// calibrating obstacle velocity...',
  '// awaiting brave engineers...',
]

export default function LobbyPage({ pin, players, onStartGame, connectionStatus }) {
  const joinUrl = `${window.location.protocol}//${window.location.hostname}:5173`
  const [lineIdx, setLineIdx] = useState(0)

  // Cycle through flavor text every 2.5 seconds
  useEffect(() => {
    const t = setInterval(
      () => setLineIdx((i) => (i + 1) % LOBBY_LINES.length),
      2500
    )
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{
      height:  '100%',
      display: 'grid',
      gridTemplateColumns: '300px 1fr',
      gap:     '32px',
      padding: '36px',
      alignItems: 'start',
      background: '#0d1117',
    }}>

      {/* Left panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

        {/* Logo */}
        <div>
          <div style={{
            color:      '#58a6ff',
            fontSize:   '26px',
            fontWeight: 700,
          }}>
            $ push to prod
          </div>
          <div style={{
            color:     '#8b949e',
            fontSize:  '12px',
            marginTop: '4px',
            minHeight: '18px',
            transition: 'opacity 0.4s',
          }}>
            {LOBBY_LINES[lineIdx]}
          </div>
        </div>

        {/* QR code */}
        {pin ? (
          <QRDisplay joinUrl={joinUrl} pin={pin} />
        ) : (
          <div style={{
            background:   '#161b22',
            border:       '1px solid #30363d',
            borderRadius: '16px',
            padding:      '48px 24px',
            textAlign:    'center',
            color:        '#8b949e',
            fontSize:     '13px',
          }}>
            {connectionStatus === 'connected' ? 'creating room...' : `server ${connectionStatus}`}
          </div>
        )}

        {/* Start button needs at least 1 player */}
        {pin && players.length >= 1 && (
          <button
            onClick={onStartGame}
            style={{
              background:   'linear-gradient(135deg, #238636, #2ea043)',
              border:       'none',
              borderRadius: '10px',
              color:        '#fff',
              cursor:       'pointer',
              fontSize:     '16px',
              fontFamily:   'inherit',
              fontWeight:   700,
              padding:      '16px',
              width:        '100%',
              letterSpacing: '0.5px',
              boxShadow:    '0 0 20px #23863640',
              transition:   'transform 0.1s, box-shadow 0.1s',
            }}
            onMouseEnter={(e) => {
              e.target.style.transform  = 'scale(1.02)'
              e.target.style.boxShadow  = '0 0 30px #23863660'
            }}
            onMouseLeave={(e) => {
              e.target.style.transform  = 'scale(1)'
              e.target.style.boxShadow  = '0 0 20px #23863640'
            }}
          >
            🚀 push to prod →
          </button>
        )}

        {pin && players.length === 0 && (
          <div style={{
            color:      '#8b949e',
            fontSize:   '13px',
            textAlign:  'center',
            fontStyle:  'italic',
            padding:    '12px',
          }}>
            waiting for devs to join...
          </div>
        )}
      </div>

      {/* Right panel: player list  */}
      <div>
        <div style={{
          display:      'flex',
          alignItems:   'center',
          gap:          '10px',
          marginBottom: '20px',
        }}>
          <span style={{ color: '#3fb950', fontSize: '10px' }}>●</span>
          <span style={{
            color:     '#8b949e',
            fontSize:  '13px',
          }}>
            {players.length} / 50 engineers connected
          </span>
          {/* Live pulse */}
          {players.length > 0 && (
            <span style={{
              background:   '#3fb95020',
              border:       '1px solid #3fb95040',
              borderRadius: '20px',
              color:        '#3fb950',
              fontSize:     '11px',
              padding:      '2px 10px',
            }}>
              LIVE
            </span>
          )}
        </div>

        {/* Player grid */}
        <div style={{
          display:  'flex',
          flexWrap: 'wrap',
          gap:      '10px',
        }}>
          {players.map((p, i) => (
            <div
              key={p.playerId}
              style={{
                background:   '#161b22',
                border:       '1px solid #30363d',
                borderRadius: '8px',
                padding:      '10px 16px',
                fontSize:     '14px',
                color:        '#e6edf3',
                display:      'flex',
                alignItems:   'center',
                gap:          '8px',
                animation:    'fadeIn 0.3s ease',
              }}
            >
              <span style={{
                color:    ['#58a6ff','#3fb950','#f78166','#d2a8ff','#ffa657'][i % 5],
                fontSize: '10px',
              }}>●</span>
              {p.playerName}
            </div>
          ))}
        </div>

        {players.length === 0 && (
          <div style={{
            color:     '#8b949e',
            fontSize:  '14px',
            fontStyle: 'italic',
          }}>
            scan the QR code or enter the PIN on your phone
          </div>
        )}

        {/* Instructions for projector mode */}
        {pin && (
          <div style={{
            marginTop:    '32px',
            background:   '#161b22',
            border:       '1px solid #30363d',
            borderRadius: '10px',
            padding:      '16px 20px',
            fontSize:     '12px',
            color:        '#8b949e',
            lineHeight:   1.7,
          }}>
            <div style={{ color: '#e6edf3', fontWeight: 600, marginBottom: '6px' }}>
              // how to join
            </div>
            <div>1. Open <span style={{ color: '#58a6ff' }}>{joinUrl}</span> on your phone</div>
            <div>2. Or scan the QR code →</div>
            <div>3. Enter PIN <span style={{ color: '#58a6ff', fontWeight: 700, letterSpacing: '3px' }}>{pin}</span> and your name</div>
            <div>4. Wait for the host to start</div>
          </div>
        )}
      </div>

      {/* Fade-in keyframe */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}