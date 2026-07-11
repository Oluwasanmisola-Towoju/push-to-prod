import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useHostSocket } from './hooks/useHostSocket.js'
import LobbyPage from './pages/LobbyPage.jsx'
import GamePage from './pages/GamePage.jsx'

export default function App() {
  const [pin, setPin] = useState(null)
  const [players, setPlayers] = useState([])
  const [page, setPage] = useState('lobby')
  const gameStateRef = useRef(null)

  const handleMessage = useCallback((payload) => {
    switch (payload.type) {

      case 'ROOM_CREATED':
        setPin(payload.room_pin)
        break

      case 'PLAYER_JOINED':
        setPlayers((prev) => {
          if (prev.find((p) => p.playerId === payload.player_id)) return prev
          return [...prev, {
            playerId: payload.player_id,
            playerName: payload.player_name,
          }]
        })
        break

      case 'PLAYER_LEFT':
        setPlayers((prev) =>
          prev.filter((p) => p.playerId !== payload.player_id)
        )
        break

      case 'GAME_STARTED':
        console.debug('[Host App] received GAME_STARTED')
        setPage('game')
        break

      case 'GAME_STATE':
        console.debug('[Host App] received GAME_STATE', payload.tick, payload.players?.length)
        gameStateRef.current = payload  // mutate a ref to handle physics data to prevent re-renders
        break

      case 'GAME_OVER':
        // return to lobby after a short pause so players can see the result
        setTimeout(() => {
          gameStateRef.current = null
          setPage('lobby')
          setPlayers([])
          setPin(null)
        }, 4000)
        break

      case 'PONG':
        break

      default:
        console.log('[Host] unhandled:', payload.type)
    }
  }, [])

  const { send, status } = useHostSocket(handleMessage)

  // Auto-create room as soon as the socket opens
  useEffect(() => {
    if (status === 'connected' && !pin) {
      send({ type: 'CREATE_ROOM' })
    }
  }, [status, pin, send])

  const handleStartGame = useCallback(() => {
    if (!pin) return
    send({ type: 'START_GAME', room_pin: pin })
  }, [send, pin])

  if (page === 'game') {
    return (
      <GamePage
        pin={pin}
        initialPlayers={players}
        gameStateRef={gameStateRef}
      />
    )
  }

  return (
    <LobbyPage
      pin={pin}
      players={players}
      onStartGame={handleStartGame}
      connectionStatus={status}
    />
  )
}