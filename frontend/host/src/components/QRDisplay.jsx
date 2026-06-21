import React from 'react'
import { QRCodeSVG } from 'qrcode.react'

// Interface shows a scannable QR code and the 4-digit PIN for players to join.
export default function QRDisplay({ joinUrl, pin }) {
  const fullUrl = `${joinUrl}?pin=${pin}`

  return (
    <div style={{
      background: '#161b22',
      border: '1px solid #30363d',
      borderRadius: '16px',
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '16px',
      minWidth: '240px',
    }}>
      <div style={{ color: '#8b949e', fontSize: '13px' }}>
        scan to join
      </div>

      <div style={{
        background: '#ffffff',
        borderRadius: '8px',
        padding: '12px',
      }}>
        <QRCodeSVG
          value={fullUrl}
          size={160}
          bgColor="#ffffff"
          fgColor="#0d1117"
          level="M"
        />
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#8b949e', fontSize: '12px' }}>room pin</div>
        <div style={{
          color: '#58a6ff',
          fontSize: '48px',
          fontWeight: 800,
          letterSpacing: '10px',
          lineHeight: 1.1,
        }}>
          {pin}
        </div>
      </div>

      <div style={{
        color: '#8b949e',
        fontSize: '11px',
        textAlign: 'center',
        wordBreak: 'break-all',
        maxWidth: '200px',
      }}>
        {joinUrl}
      </div>
    </div>
  )
}