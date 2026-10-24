'use client'

import { useState, useTransition } from 'react'
import { publicFichajeAction, type PublicFichajeResult } from '../actions'
import { formatDay } from '@/lib/standing-ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type Result = PublicFichajeResult | null

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
        (creditsLeft === null
          ? 'Plan libre — acceso ilimitado.'
          : `Te quedan ${creditsLeft} crédito${creditsLeft === 1 ? '' : 's'}.`) +
        ` Tu cuota vale hasta el ${formatDay(result.validUntil)}.`
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
    case 'grace_allowed': {
      color = 'yellow'
      heading = '¡Podés pasar!'
      body = `Tu cuota venció el ${formatDay(result.expiredOn)}. Renovala en la recepción.`
      break
    }
    case 'expired': {
      color = 'orange'
      heading = 'Tu cuota está vencida'
      body = `Venció el ${formatDay(result.expiredOn)}. Renovala en la recepción para seguir entrenando.`
      break
    }
    case 'not_started': {
      color = 'orange'
      heading = 'Tu cuota todavía no empezó'
      body = `Empieza el ${formatDay(result.startsOn)}. Consultá en la recepción.`
      break
    }
    case 'no_plan': {
      color = 'orange'
      heading = 'Sin plan activo'
      body = 'No tenés una cuota registrada en este gimnasio. Hablá con la recepción.'
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
    case 'error': {
      color = 'red'
      heading = 'No pudimos registrar tu ingreso'
      body = 'Intentá de nuevo o consultá con la recepción.'
      break
    }
  }

  const colorClasses = {
    green: 'bg-green-500 text-white',
    yellow: 'bg-yellow-400 text-yellow-900',
    red: 'bg-red-500 text-white',
    orange: 'bg-orange-400 text-white',
  }

  return (
    <div className="flex flex-col items-center gap-6 py-2">
      <div className={cn('w-full rounded-2xl p-8 text-center', colorClasses[color])}>
        <p className="text-4xl font-black leading-tight">{heading}</p>
        <p className="mt-3 text-sm opacity-80">{body}</p>
      </div>
      <Button variant="outline" className="w-full h-12" onClick={onReset}>
        Fichar otro ingreso
      </Button>
      <p className="text-xs text-zinc-400">{gymName}</p>
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
