'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-zinc-800">Algo salió mal</h2>
        <p className="text-sm text-zinc-500 max-w-sm">
          No se pudo cargar esta sección. Puede ser un problema de conexión
          temporal. Intentá de nuevo en unos segundos.
        </p>
        {error.digest && (
          <p className="text-xs text-zinc-400">Código: {error.digest}</p>
        )}
      </div>
      <Button variant="outline" onClick={reset}>
        Reintentar
      </Button>
    </div>
  )
}
