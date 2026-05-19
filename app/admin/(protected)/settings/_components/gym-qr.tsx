'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

type Props = {
  qrDataUrl: string
  checkInUrl: string
  gymName: string
}

export function GymQR({ qrDataUrl, checkInUrl, gymName }: Props) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(checkInUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handlePrint() {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Fichaje — ${gymName}</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 40px; }
            img { width: 280px; height: 280px; }
            h1 { font-size: 24px; margin-bottom: 8px; }
            p { font-size: 14px; color: #555; margin-top: 16px; }
          </style>
        </head>
        <body>
          <h1>${gymName}</h1>
          <p>Escaneá el código para registrar tu ingreso</p>
          <img src="${qrDataUrl}" alt="QR Fichaje" />
          <p style="font-size:11px; color:#888; margin-top:12px;">${checkInUrl}</p>
          <script>window.onload = () => window.print()</script>
        </body>
      </html>
    `)
    win.document.close()
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <img
        src={qrDataUrl}
        alt="QR para fichaje público"
        className="rounded-lg border"
        width={220}
        height={220}
      />
      <p className="max-w-xs break-all text-center text-xs text-zinc-500">{checkInUrl}</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? 'Copiado' : 'Copiar enlace'}
        </Button>
        <Button variant="outline" size="sm" onClick={handlePrint}>
          Imprimir QR
        </Button>
      </div>
    </div>
  )
}
