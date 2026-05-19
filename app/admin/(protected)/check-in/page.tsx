import { CheckInClient } from './_components/check-in-client'

export default function CheckInPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Fichaje</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Ingresá el número de documento o nombre del socio para registrar su ingreso.
        </p>
      </div>
      <CheckInClient />
    </div>
  )
}
