export function makeMockState(tick) {
  const t = tick / 20
  return {
    type: 'GAME_STATE',
    tick,
    game_over: false,
    players: [
      {
        player_id: 'mock-1',
        player_name: 'latte',
        x: 6,
        y: 2,
        score: 3,
        is_alive: true,
        stamina: 150,
        is_invulnerable: true,
        invulnerable_for: Math.max(0, 1.6 - (t % 1.6)),
      },
      {
        player_id: 'mock-2',
        player_name: 'decaf',
        x: 3,
        y: 6,
        score: 1,
        is_alive: true,
        stamina: 100,
        is_invulnerable: false,
        invulnerable_for: 0,
      },
    ],
    obstacles: [
      {
        id: 'obs_espresso',
        type: 'ESPRESSO_SHOT',
        x: ((t * 2) % 12) - 1,
        y: 4,
        w: 0.8,
        h: 0.9,
        vx: 2,
        lane: 4,
      },
      {
        id: 'obs_bug',
        type: 'BUG',
        x: 8,
        y: 7,
        w: 1.5,
        h: 0.9,
        vx: -4,
        lane: 7,
      },
    ],
  }
}
