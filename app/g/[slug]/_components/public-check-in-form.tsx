'use client'

import { useState, useTransition } from 'react'
import { publicFichajeAction } from '../actions'
import type { FichajeResult } from '@/lib/domain/fichaje'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type Result = FichajeResult | { status: 'invalid_gym' } | null

function ResultScreen({
  result,
  gymName,
  onReset,
}: {
  result: Result
  gymName: string
  onReset: () => void
}) {
  if (!result) return null

  let color: 'green' | 'yellow' | 'red' | 'orange' = 'red'
  let heading = ''
  let body = ''

  switch (result.status) {
    case 'ok': {
      color = 'green'
      heading = '¡Podés pasar!'
      const creditsLeft = result.creditsLeft
      body =
        creditsLeft === null
          ? 'Plan libre — acceso ilimitado.'
          : `Te quedan ${creditsLeft} crédito${creditsLeft === 1 ? '' : 's'} este mes.`
      break
    }
    case 'over_limit_allowed': {
      color = 'yellow'
      heading = 'Ingreso registrado'
      body = 'Entraste sin créditos disponibles. Consultá con el gimnasio.'
      break
    }
    case 'already_today': {
      color = 'yellow'
      heading = 'Ya registramos tu ingreso hoy'
      body = 'Solo se permite un fichaje por día en este gimnasio.'
      break
    }
    case 'no_active_enrollment': {
      color = 'orange'
      heading = 'Sin plan activo'
      body = 'No tenés una inscripción activa en este gimnasio. Hablá con la recepción.'
      break
    }
    case 'over_limit_denied': {
      color = 'red'
      heading = 'No podés pasar'
      body = 'No tenés créditos disponibles. Hablá con la recepción.'
      break
    }
    case 'not_found': {
      color = 'red'
      heading = 'No encontramos tu documento'
      body = 'Verificá el número ingresado o consultá con la recepción.'
      break
    }
    case 'invalid_gym': {
      color = 'red'
      heading = 'Gimnasio no encontrado'
      body = 'El enlace no es válido.'
      break
    }
    case 'multiple_matches': {
      // Should not happen with exact DNI search on public endpoint
      color = 'red'
      heading = 'Error de búsqueda'
      body = 'Consultá con la recepción.'
      break
    }
  }

  const colorClasses = {
    green: 'bg-green-50 border-green-300 text-green-900',
    yellow: 'bg-yellow-50 border-yellow-300 text-yellow-900',
    red: 'bg-red-50 border-red-300 text-red-900',
    orange: 'bg-orange-50 border-orange-300 text-orange-900',
  }

  const memberName =
    result.status !== 'not_found' &&
    result.status !== 'invalid_gym' &&
    result.status !== 'multiple_matches' &&
    'member' in result
      ? result.member.fullName
      : null

  return (
    <div className="space-y-6">
      <div className={cn('rounded-2xl border-4 p-10 text-center', colorClasses[color])}>
        <p className="text-3xl font-black">{heading}</p>
        {memberName && <p className="mt-3 text-lg font-semibold">{memberName}</p>}
        <p className="mt-3 text-sm opacity-80">{body}</p>
      </div>
      <div className="text-center">
        <Button variant="outline" onClick={onReset}>
          Fichar otro ingreso
        </Button>
      </div>
      <p className="text-center text-xs text-zinc-400">{gymName}</p>
    </div>
  )
}

export function PublicCheckInForm({
  slug,
  gymName,
}: {
  slug: string
  gymName: string
}) {
  const [documentNumber, setDocumentNumber] = useState('')
  const [result, setResult] = useState<Result>(null)
  const [isPending, startTransition] = useTransition()

  function reset() {
    setResult(null)
    setDocumentNumber('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!documentNumber.trim()) return
    startTransition(async () => {
      const res = await publicFichajeAction(slug, documentNumber)
      setResult(res)
    })
  }

  if (result) {
    return <ResultScreen result={result} gymName={gymName} onReset={reset} />
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="pub-doc" className="text-base">
          Número de documento (DNI)
        </Label>
        <Input
          id="pub-doc"
          type="text"
          inputMode="numeric"
          value={documentNumber}
          onChange={(e) => setDocumentNumber(e.target.value)}
          placeholder="35123456"
          autoFocus
          autoComplete="off"
          className="h-14 text-xl text-center tracking-widest"
          disabled={isPending}
        />
      </div>
      <Button
        type="submit"
        className="w-full h-14 text-base"
        disabled={isPending || !documentNumber.trim()}
      >
        {isPending ? 'Verificando…' : 'Registrar ingreso'}
      </Button>
    </form>
  )
}
