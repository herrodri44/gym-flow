import Link from 'next/link'
import { acceptTermsAction } from './actions'

export default function AcceptTermsPage() {
  return (
    <div className="min-h-svh bg-zinc-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <span className="text-2xl font-bold tracking-tight text-[#1B2845]">GymDex</span>
          <h1 className="text-xl font-semibold text-zinc-800 mt-2">
            Antes de continuar
          </h1>
          <p className="text-sm text-zinc-500">
            Revisá y aceptá los términos para usar la plataforma.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border bg-white shadow-sm divide-y">
          {/* Términos y Condiciones */}
          <div className="p-5 space-y-2">
            <h2 className="font-semibold text-zinc-800">Términos y Condiciones</h2>
            <ul className="text-sm text-zinc-600 space-y-1.5 list-disc list-inside">
              <li>
                GymDex es un sistema de registro interno. <strong>No procesa ni audita pagos</strong> —
                la veracidad de los cobros es responsabilidad del gimnasio.
              </li>
              <li>
                El servicio está en fase piloto. No garantizamos disponibilidad 24/7 ni nos
                responsabilizamos por interrupciones temporales.
              </li>
              <li>
                Los datos que cargás son de tu propiedad. GymDex los aloja únicamente para
                prestar el servicio y <strong>no los comparte con terceros</strong>.
              </li>
              <li>
                GymDex mantiene estricta confidencialidad sobre la información comercial del
                gimnasio y los datos personales de sus socios.
              </li>
            </ul>
            <Link
              href="/legal/terminos"
              target="_blank"
              className="text-xs text-blue-600 hover:underline"
            >
              Leer texto completo →
            </Link>
          </div>

          {/* Política de Privacidad */}
          <div className="p-5 space-y-2">
            <h2 className="font-semibold text-zinc-800">Política de Privacidad</h2>
            <p className="text-sm text-zinc-600">
              De acuerdo con la Ley 25.326 (Argentina), los datos personales de los socios
              se usan exclusivamente para la gestión de membresías y no se utilizan con
              fines comerciales ni publicitarios.
            </p>
            <Link
              href="/legal/privacidad"
              target="_blank"
              className="text-xs text-blue-600 hover:underline"
            >
              Leer texto completo →
            </Link>
          </div>
        </div>

        {/* Acción */}
        <form action={acceptTermsAction}>
          <button
            type="submit"
            className="w-full rounded-lg bg-[#1B2845] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#274060] transition-colors"
          >
            Leí y acepto los Términos y la Política de Privacidad
          </button>
        </form>

        <p className="text-center text-xs text-zinc-400">
          Al aceptar, se registra tu consentimiento con fecha y hora.
        </p>
      </div>
    </div>
  )
}
