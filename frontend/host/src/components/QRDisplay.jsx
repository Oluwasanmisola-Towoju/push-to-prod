import React from 'react'
import { QRCodeSVG } from 'qrcode.react'

export default function QRDisplay({ joinUrl, pin }) {
  const fullUrl = `${joinUrl}?pin=${pin}`

  return (
    <div style={{
      background:    '#161b22',
      border:        '1px solid #30363d',
      borderRadius:  '16px',
      padding:       '24px',
      display:       'flex',
      flexDirection: 'column',
      alignItems:    'center',
      gap:           '16px',
    }}>
      <div style={{ color: '#8b949e', fontSize: '12px' }}>
        scan to join instantly
      </div>

      {/* QR code */}
      <div style={{
        background:   '#ffffff',
        borderRadius: '10px',
        padding:      '14px',
        boxShadow:    '0 0 24px #58a6ff22',
      }}>
        <QRCodeSVG
          value={fullUrl}
          size={168}
          bgColor="#ffffff"
          fgColor="#0d1117"
          level="M"
        />
      </div>

      {/* PIN display */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#8b949e', fontSize: '11px', marginBottom: '4px' }}>
          or enter room pin manually
        </div>
        <div style={{
          color:         '#58a6ff',
          fontSize:      '52px',
          fontWeight:    800,
          letterSpacing: '12px',
          lineHeight:    1,
          textShadow:    '0 0 20px #58a6ff60',
        }}>
          {pin}
        </div>
      </div>

      {/* URL hint */}
      <div style={{
        color:      '#484f58',
        fontSize:   '10px',
        textAlign:  'center',
        wordBreak:  'break-all',
        maxWidth:   '220px',
      }}>
        {joinUrl}
      </div>
    </div>
  )
}