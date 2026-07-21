import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useWebSocket, ConnectionStatus } from './hooks/useWebSocket.js'
import { buildInputPayload } from './utils/inputNormalizer.js'
import { useSound } from './hooks/useSound.js'
import JoinPage from './components/JoinPage.jsx'
import ControllerPage from './components/ControllerPage.jsx'

const SESSION_KEY = 'ptp_player'

function loadSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null') }
  catch { return null }
}
function saveSession(data) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data))
}
function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
}

export default function App() {
  const [player, setPlayer] = useState(null)
  const [gameState, setGameState] = useState('lobby')
  const [error, setError] = useState(null)
  const [pendingJoin, setPendingJoin] = useState(null)
  const [playerStatus, setPlayerStatus] = useState({ isAlive: true, score: 0 })

  const playerRef = useRef(null)
  const wasAliveRef = useRef(true)
  const prevScoreRef = useRef(0)
  const soundEnabled = useRef(true)

  const { playMove, playScore, playDeath, playGameOver, playJoin } = useSound(soundEnabled.current)

  const handleMessage = useCallback((payload) => {
    setError(null)

    switch (payload.type) {

      case 'JOIN_ACK': {
        const session = {
          playerId: payload.player_id,
          playerName: payload.player_name,
          roomPin: payload.room_pin,
        }
        setPlayer(session)
        playerRef.current = session
        saveSession(session)
        setPendingJoin(null)
        playJoin()
        break
      }

      case 'GAME_STARTED':
        setGameState('in_game')
        setPlayerStatus({ isAlive: true, score: 0 })
        wasAliveRef.current = true
        prevScoreRef.current = 0
        break

      case 'GAME_STATE': {
        const me = payload.players?.find(
          (p) => p.player_id === playerRef.current?.playerId
        )
        if (me) {
          // detect death transition
          if (wasAliveRef.current && !me.is_alive) {
            playDeath()
          }
          // detect score increase
          if (me.score > prevScoreRef.current) {
            playScore()
          }
          wasAliveRef.current = me.is_alive
          prevScoreRef.current = me.score
          setPlayerStatus({ isAlive: me.is_alive, score: me.score })
        }
        break
      }

      case 'GAME_OVER':
        playGameOver()
        setTimeout(() => {
          setGameState('lobby')
          setPlayerStatus({ isAlive: true, score: 0 })
          wasAliveRef.current = true
          prevScoreRef.current = 0
        }, 4000)
        break

      case 'HOST_DISCONNECTED':
        setGameState('lobby')
        setPlayer(null)
        playerRef.current = null
        clearSession()
        setError('The host ended the game.')
        break

      case 'ERROR':
        setError(payload.message)
        break

      default:
        break
    }
  }, [playJoin, playDeath, playScore, playGameOver])

  const { send, status } = useWebSocket('/ws/player', handleMessage)

  // On reconnect: silently re-join the game with already stored player_id
  useEffect(() => {
    if (status !== ConnectionStatus.CONNECTED) return
    const session = loadSession()
    if (session && !player) {
      send({
        type: 'JOIN_ROOM',
        room_pin: session.roomPin,
        player_name: session.playerName,
        player_id: session.playerId,
      })
    }
    if (pendingJoin) send(pendingJoin)
  }, [status]) // eslint-disable-line

  const handleJoin = useCallback((pin, name) => {
    setError(null)
    const payload = { type: 'JOIN_ROOM', room_pin: pin, player_name: name }
    if (!send(payload)) setPendingJoin(payload)
  }, [send])

  const handleAction = useCallback((action) => {
    if (!player) return
    playMove()
    send(buildInputPayload(player.playerId, action))
  }, [send, player, playMove])

  // Render
  if (player && gameState === 'in_game') {
    return (
      <ControllerPage
        playerName={player.playerName}
        roomPin={player.roomPin}
        onAction={handleAction}
        playerStatus={playerStatus}
      />
    )
  }

  if (player) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '24px',
      }}>
        <div style={{ color: '#58a6ff', fontSize: '22px', fontWeight: 700 }}>
          $ push to prod
        </div>
        <div style={{ color: '#3fb950', fontSize: '14px' }}>
          ● waiting for host to start...
        </div>
        <div style={{ color: '#8b949e', fontSize: '16px' }}>
          {player.playerName}
        </div>
        <div style={{
          background: '#161b22',
          border: '1px solid #30363d',
          borderRadius: '8px',
          padding: '12px 32px',
          textAlign: 'center',
        }}>
          <div style={{ color: '#8b949e', fontSize: '12px' }}>room pin</div>
          <div style={{
            color: '#e6edf3',
            fontSize: '32px',
            letterSpacing: '8px',
            fontWeight: 700,
          }}>
            {player.roomPin}
          </div>
        </div>
      </div>
    )
  }

  return (
    <JoinPage
      onJoin={handleJoin}
      connectionStatus={status}
      error={error}
    />
  )
}