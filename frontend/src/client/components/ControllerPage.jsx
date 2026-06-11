import React, {useCallback, useRef } from 'react';
import { useKeyboard } from '../hooks/useKeyboard';
import { useGamepad } from '../hooks/useGamepad';

const BTN_SIZE = 80;
const BTN_GAP = 8;

function DPadButton({ label, action, onAction }) {
    const pressedRef = useRef(false);

    const handleStart = (e) => {
        e.preventDefault();
        if (!pressedRef.current) {
            pressedRef.current = true;
            onAction(action);
        }
    }

    const handleEnd = (e) => {
        e.preventDefault()
        pressedRef.current = false
    }

    return (
        <button
            style={{
                width: BTN_SIZE,
                height: BTN_SIZE,
                background: '#21262d',
                border: '2px solid #30363d',
                borderRadius: '12px',
                color: '#58a6ff',
                fontSize: '28px',
                fontFamily: 'inherit',
                cursor: 'pointer',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                touchAction: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                WebkitTapHighlightColor: 'transparent',
                transition: 'background 0.08s'
            }}
            onPointerDown={handleStart}
            onPointerUp={handleEnd}
            onPointerLeave={handleEnd}
        >
            {label}
        </button>
    )
}
 
export default function ControllerPage({ playerName, roomPin, onAction }) {
  const sendAction = useCallback((action) => {
    onAction(action)
  }, [onAction])
 
  // initialize all hardware listeners
  useKeyboard(sendAction, true)
  useGamepad(sendAction, true)
 
  const gap = BTN_GAP
  const center = BTN_SIZE + gap
 
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '20px 16px',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#3fb950', fontSize: '14px', fontWeight: 600 }}>
          ● in game
        </div>
        <div style={{ color: '#58a6ff', fontSize: '18px', marginTop: '4px' }}>
          {playerName}
        </div>
        <div style={{ color: '#8b949e', fontSize: '12px', marginTop: '2px' }}>
          room {roomPin}
        </div>
      </div>
 
      {/* D-Pad */}
      <div style={{
        position: 'relative',
        width: BTN_SIZE * 3 + gap * 2,
        height: BTN_SIZE * 3 + gap * 2,
      }}>
        {/* Up */}
        <div style={{ position: 'absolute', top: 0, left: center }}>
          <DPadButton label="▲" action="MOVE_UP" onAction={sendAction} />
        </div>
        {/* Left */}
        <div style={{ position: 'absolute', top: center, left: 0 }}>
          <DPadButton label="◀" action="MOVE_LEFT" onAction={sendAction} />
        </div>
        {/* Center */}
        <div style={{
          position: 'absolute',
          top: center,
          left: center,
          width: BTN_SIZE,
          height: BTN_SIZE,
          background: '#0d1117',
          borderRadius: '50%',
          border: '2px solid #21262d',
        }} />
        {/* Right */}
        <div style={{ position: 'absolute', top: center, left: center * 2 }}>
          <DPadButton label="▶" action="MOVE_RIGHT" onAction={sendAction} />
        </div>
        {/* Down */}
        <div style={{ position: 'absolute', top: center * 2, left: center }}>
          <DPadButton label="▼" action="MOVE_DOWN" onAction={sendAction} />
        </div>
      </div>
 
      {/* Footer hint */}
      <div style={{ color: '#8b949e', fontSize: '11px', textAlign: 'center' }}>
        Keyboard / Gamepad also works
      </div>
    </div>
  )
}