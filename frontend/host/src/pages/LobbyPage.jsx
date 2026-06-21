import React from 'react'
import QRDisplay from '../components/QRDisplay.jsx'

export default function LobbyPage({ pin, players, onStartGame, connectionStatus }) {
  const joinUrl =
    `${window.location.protocol}//${window.location.hostname}:5173`

  return (
    <div style={{
      height: '100%',
      display: 'grid',
      gridTemplateColumns: '280px 1fr',
      gap: '24px',
      padding: '32px',
      alignItems: 'start',
    }}>

      {/* On the left: QR, PIN and Start */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ color: '#58a6ff', fontSize: '22px', fontWeight: 700 }}>
          $ push to prod
        </div>
        <div style={{ color: '#8b949e', fontSize: '12px', marginTop: '-10px' }}>
          // waiting for players
        </div>

        {pin ? (
          <QRDisplay joinUrl={joinUrl} pin={pin} />
        ) : (
          <div style={{ color: '#8b949e', fontSize: '14px' }}>
            {connectionStatus === 'connected'
              ? 'creating room...'
              : `server ${connectionStatus}`}
          </div>
        )}

        {pin && players.length >= 1 && (
          <button
            onClick={onStartGame}
            style={{
              background: '#238636',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '16px',
              fontFamily: 'inherit',
              fontWeight: 600,
              padding: '14px',
              width: '100%',
            }}
          >
            start game →
          </button>
        )}
      </div>

      {/* On the right: player list */}
      <div>
        <div style={{
          color: '#8b949e',
          fontSize: '13px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{ color: '#3fb950' }}>●</span>
          {players.length} player{players.length !== 1 ? 's' : ''} connected
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {players.map((p) => (
            <div
              key={p.playerId}
              style={{
                background: '#161b22',
                border: '1px solid #30363d',
                borderRadius: '8px',
                padding: '10px 16px',
                fontSize: '14px',
                color: '#e6edf3',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span style={{ color: '#3fb950', fontSize: '10px' }}>●</span>
              {p.playerName}
            </div>
          ))}
        </div>

        {players.length === 0 && (
          <div style={{
            color: '#8b949e',
            fontSize: '14px',
            fontStyle: 'italic',
            marginTop: '8px',
          }}>
            scan the QR code or enter the PIN on your phone...
          </div>
        )}
      </div>
    </div>
  )
}