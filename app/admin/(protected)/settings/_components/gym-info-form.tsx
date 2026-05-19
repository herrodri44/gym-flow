'use client'

import { useActionState } from 'react'
import { updateGymInfoAction } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  name: string
  address: string | null
  phone: string | null
  email: string | null
  openingHours: string | null
  timezone: string
}

type ActionState = { error?: string; success?: boolean } | undefined

const TIMEZONES = [
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (ART, UTC-3)' },
  { value: 'America/Argentina/Cordoba', label: 'Córdoba (ART, UTC-3)' },
  { value: 'America/Argentina/Mendoza', label: 'Mendoza (ART, UTC-3)' },
  { value: 'America/Argentina/Tucuman', label: 'Tucumán (ART, UTC-3)' },
  { value: 'America/Argentina/Salta', label: 'Salta (ART, UTC-3)' },
  { value: 'America/Argentina/Jujuy', label: 'Jujuy (ART, UTC-3)' },
  { value: 'America/Argentina/San_Juan', label: 'San Juan (ART, UTC-3)' },
  { value: 'America/Argentina/La_Rioja', label: 'La Rioja (ART, UTC-3)' },
  { value: 'America/Argentina/Catamarca', label: 'Catamarca (ART, UTC-3)' },
  { value: 'America/Argentina/Rio_Gallegos', label: 'Río Gallegos (ART, UTC-3)' },
  { value: 'America/Argentina/Ushuaia', label: 'Ushuaia (ART, UTC-3)' },
]

export function GymInfoForm({ name, address, phone, email, openingHours, timezone }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_, fd) => updateGymInfoAction(fd),
    undefined,
  )

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="gi-name">Nombre del gimnasio</Label>
        <Input
          id="gi-name"
          name="name"
          defaultValue={name}
          placeholder="CrossFit Palermo"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="gi-phone">Teléfono</Label>
          <Input
            id="gi-phone"
            name="phone"
            defaultValue={phone ?? ''}
            placeholder="+54 11 1234-5678"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gi-email">Email de contacto</Label>
          <Input
            id="gi-email"
            name="email"
            type="email"
            defaultValue={email ?? ''}
            placeholder="info@mygym.com"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="gi-address">Dirección</Label>
        <Input
          id="gi-address"
          name="address"
          defaultValue={address ?? ''}
          placeholder="Av. Santa Fe 1234, CABA"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="gi-openingHours">Horarios de apertura</Label>
        <Input
          id="gi-openingHours"
          name="openingHours"
          defaultValue={openingHours ?? ''}
          placeholder="Lun–Vie 7–22 / Sáb 8–20"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="gi-timezone">Huso horario</Label>
        <select
          id="gi-timezone"
          name="timezone"
          defaultValue={timezone}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
      </div>

      {state?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}
      {state?.success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Información guardada correctamente.
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar información'}
        </Button>
      </div>
    </form>
  )
}
