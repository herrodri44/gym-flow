'use client'

import { useActionState } from 'react'
import { updateOperationalSettingsAction } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  allowOverLimit: boolean
  lowCreditsThreshold: number
  autoGeneratePayments: boolean
}

type ActionState = { error?: string; success?: boolean } | undefined

export function OperationalSettingsForm({ allowOverLimit, lowCreditsThreshold, autoGeneratePayments }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_, fd) => updateOperationalSettingsAction(fd),
    undefined,
  )

  return (
    <form action={formAction} className="space-y-6">
      <div className="flex items-start gap-3">
        <input
          id="os-allowOverLimit"
          name="allowOverLimit"
          type="checkbox"
          defaultChecked={allowOverLimit}
          className="mt-1 h-4 w-4 rounded border-gray-300"
        />
        <div>
          <Label htmlFor="os-allowOverLimit" className="font-medium">
            Permitir ingreso cuando el socio tiene 0 créditos
          </Label>
          <p className="mt-0.5 text-sm text-zinc-500">
            Si está activo, el socio puede fichar igual con una advertencia visible. El ingreso queda
            marcado como "por encima del límite".
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <input
          id="os-autoGeneratePayments"
          name="autoGeneratePayments"
          type="checkbox"
          defaultChecked={autoGeneratePayments}
          className="mt-1 h-4 w-4 rounded border-gray-300"
        />
        <div>
          <Label htmlFor="os-autoGeneratePayments" className="font-medium">
            Generar cuotas automáticamente cada mes
          </Label>
          <p className="mt-0.5 text-sm text-zinc-500">
            Si está activo, el sistema genera cuotas pendientes para todos los socios activos el
            primer día de cada mes. Al desactivarlo, el botón "Generar cuotas del mes" queda
            habilitado en la página de pagos para hacerlo manualmente.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="os-lowCreditsThreshold">Umbral de créditos bajos (dashboard)</Label>
        <Input
          id="os-lowCreditsThreshold"
          name="lowCreditsThreshold"
          type="number"
          min="0"
          step="1"
          defaultValue={lowCreditsThreshold}
          className="max-w-[120px]"
        />
        <p className="text-xs text-zinc-500">
          Los socios con esta cantidad de créditos o menos se muestran en el dashboard como "cerca de cero".
          Valor por defecto: 2.
        </p>
      </div>

      {state?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}
      {state?.success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Configuración guardada correctamente.
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar configuración'}
        </Button>
      </div>
    </form>
  )
}
