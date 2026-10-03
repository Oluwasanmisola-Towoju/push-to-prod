import { useEffect, useState } from 'react'

export function useHudSnapshot(gameStateRef, intervalMs = 250) {
  const [snapshot, setSnapshot] = useState({ players: [], gameOver: false, tick: 0 })

  useEffect(() => {
    const readSnapshot = () => {
      const state = gameStateRef.current
      const next = {
        tick: state?.tick ?? 0,
        gameOver: state?.game_over ?? false,
        players: (state?.players ?? [])
          .map((p) => ({
            id: p.player_id,
            name: p.player_name,
            score: p.score ?? 0,
            stamina: p.stamina ?? 100,
            shield: p.is_invulnerable ?? false,
            alive: p.is_alive ?? false,
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 8),
      }
      setSnapshot((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next)
    }
    readSnapshot()
    const timer = window.setInterval(readSnapshot, intervalMs)
    return () => window.clearInterval(timer)
  }, [gameStateRef, intervalMs])

  return snapshot
}
