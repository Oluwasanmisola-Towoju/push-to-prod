import React, { useState } from 'react'

const s = {
  page: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    gap: '20px',
  },
  logo: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#58a6ff',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: '12px',
    color: '#8b949e',
    marginTop: '-14px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    width: '100%',
    maxWidth: '320px',
  },
  input: {
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: '8px',
    color: '#e6edf3',
    fontSize: '18px',
    fontFamily: 'inherit',
    padding: '14px 16px',
    textAlign: 'center',
    letterSpacing: '4px',
    outline: 'none',
    width: '100%',
  },
  nameInput: {
    letterSpacing: '1px',
    fontSize: '16px',
  },
  btn: {
    background: '#238636',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '16px',
    fontFamily: 'inherit',
    fontWeight: 600,
    padding: '16px',
    width: '100%',
    marginTop: '4px',
  },
  error: {
    background: '#2d1215',
    border: '1px solid #f85149',
    borderRadius: '6px',
    color: '#f85149',
    fontSize: '13px',
    padding: '10px 14px',
    textAlign: 'center',
  },
  status: {
    fontSize: '12px',
    color: '#8b949e',
  },
}

export default function JoinPage({ onJoin, connectionStatus, error }) {
  const [pin, setPin] = useState('')
  const [name, setName] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (pin.length === 4 && name.trim()) {
      onJoin(pin.trim(), name.trim())
    }
  }

  const statusColor = {
    connected: '#3fb950',
    connecting: '#d29922',
    reconnecting: '#d29922',
    disconnected: '#f85149',
  }[connectionStatus] || '#8b949e'

  const canSubmit = 
  pin.length === 4 && name.trim() && connectionStatus === 'connected'

  return (
    <div style={s.page}>
      <div style={s.logo}>$ push to prod</div>
      <div style={s.subtitle}>// survive the deploy</div>

      <form style={s.form} onSubmit={handleSubmit}>
        <input
          style={s.input}
          type="text"
          inputMode="numeric"
          maxLength={4}
          placeholder="PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          autoFocus
        />
        <input
          style={{ ...s.input, ...s.nameInput }}
          type="text"
          maxLength={20}
          placeholder="your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          style={{
            ...s.btn,
            opacity: (pin.length === 4 && name.trim() && connectionStatus === 'connected') ? 1 : 0.5,
          }}
          type="submit"
          disabled={pin.length !== 4 || !name.trim() || connectionStatus !== 'connected'}
        >
          join game →
        </button>
      </form>

      {error && <div style={s.error}>{error}</div>}

      <div style={{ ...s.status, color: statusColor }}>
        ● {connectionStatus}
      </div>
    </div>
  )
}