import React, { useCallback, useRef } from 'react';
import { useKeyboard } from '../hooks/useKeyboard';
import { useGamepad } from '../hooks/useGamepad';
import { useSwipe } from '../hooks/useSwipe'

const BTN_SIZE = 88;
const BTN_GAP = 10;
const CTR = BTN_GAP + BTN_SIZE

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
      type="button"
      style={{
        width: BTN_SIZE,
        height: BTN_SIZE,
        background: '#21262d',
        border: '2px solid #30363d',
        borderRadius: '14px',
        color: '#58a6ff',
        fontSize: '26px',
        fontFamily: 'inherit',
        cursor: 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        WebkitTapHighlightColor: 'transparent',
        transition: 'background 0.08s',
      }}
      onPointerDown={handleStart}
      onPointerUp={handleEnd}
      onPointerLeave={handleEnd}
      onPointerCancel={handleEnd}
    >
      {label}
    </button>
  )
}

export default function ControllerPage({ playerName, roomPin, onAction, playerStatus }) {
  const isAlive = playerStatus?.isAlive !== false
  const score = playerStatus?.score ?? 0

  const sendAction = useCallback((action) => {
    onAction(action)
  }, [onAction])

  useKeyboard(sendAction, isAlive)
  useGamepad(sendAction, isAlive)
  useSwipe(sendAction, isAlive)

  const gap = BTN_GAP
  const center = BTN_SIZE + gap

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '24px 16px 20px',
      userSelect: 'none',
    }}>

      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{
          color: isAlive ? '#3fb950' : '#f85149',
          fontSize: '14px',
          fontWeight: 600,
          transition: 'color 0.3s',
        }}>
          {isAlive ? '● in game' : '✕ eliminated'}
        </div>

        <div style={{ color: '#58a6ff', fontSize: '20px', fontWeight: 700 }}>
          {playerName}
        </div>

        <div style={{ color: '#8b949e', fontSize: '12px' }}>
          room {roomPin}
        </div>

        {score > 0 && (
          <div style={{
            marginTop: '4px',
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: '20px',
            padding: '4px 14px',
            color: '#58a6ff',
            fontSize: '13px',
            fontWeight: 600,
          }}>
            ×{score} deploys
          </div>
        )}
      </div>

      {isAlive ? (
        <div style={{
          position: 'relative',
          width: BTN_SIZE * 3 + gap * 2,
          height: BTN_SIZE * 3 + gap * 2,
        }}>
          <div style={{ position: 'absolute', top: 0, left: CTR }}>
            <DPadButton label="▲" action="MOVE_UP" onAction={sendAction} />
          </div>
          <div style={{ position: 'absolute', top: CTR, left: 0 }}>
            <DPadButton label="◀" action="MOVE_LEFT" onAction={sendAction} />
          </div>
          <div style={{
            position: 'absolute',
            top: CTR,
            left: CTR,
            width: BTN_SIZE,
            height: BTN_SIZE,
            background: '#0d1117',
            borderRadius: '50%',
            border: '2px solid #21262d',
          }} />
          <div style={{ position: 'absolute', top: CTR, left: CTR * 2 }}>
            <DPadButton label="▶" action="MOVE_RIGHT" onAction={sendAction} />
          </div>
          <div style={{ position: 'absolute', top: CTR * 2, left: CTR }}>
            <DPadButton label="▼" action="MOVE_DOWN" onAction={sendAction} />
          </div>
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          padding: '32px',
        }}>
          <div style={{
            fontSize: '64px',
            lineHeight: 1,
            filter: 'grayscale(1)',
          }}>
            💀
          </div>
          <div style={{
            color: '#f85149',
            fontSize: '22px',
            fontWeight: 700,
          }}>
            you got pushed
          </div>
          <div style={{ color: '#8b949e', fontSize: '13px', textAlign: 'center' }}>
            watch the host screen
          </div>
          {score > 0 && (
            <div style={{
              color: '#58a6ff',
              fontSize: '16px',
              fontWeight: 600,
            }}>
              final score: ×{score}
            </div>
          )}
        </div>
      )}

      <div style={{
        color: '#484f58',
        fontSize: '11px',
        textAlign: 'center',
      }}>
        {isAlive ? 'swipe · tap · keyboard · gamepad' : ''}
      </div>
    </div>
  )
}