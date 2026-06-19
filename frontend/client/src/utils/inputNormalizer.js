// actions from all input sources whether keyboard, touch or gamepad
export const ACTIONS = Object.freeze({
  MOVE_UP: 'MOVE_UP',
  MOVE_DOWN: 'MOVE_DOWN',
  MOVE_LEFT: 'MOVE_LEFT',
  MOVE_RIGHT: 'MOVE_RIGHT',
  IDLE: 'IDLE',
});

// Normalize and Build the standard player input into a canonical Websocket payload shape
export function buildInputPayload(playerId, action) { // takes in one of the action values and the player_id
  return {
    type: 'PLAYER_INPUT',
    player_id: playerId,
    action,
  }
}