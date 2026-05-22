import { notFound } from 'next/navigation'
import { db } from '@/lib/db/client'
import { gyms } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { PublicCheckInForm } from './_components/public-check-in-form'
import Link from 'next/link'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function PublicCheckInPage({ params }: Props) {
  const { slug } = await params

  const [gym] = await db
    .select({ id: gyms.id, name: gyms.name, slug: gyms.slug })
    .from(gyms)
    .where(eq(gyms.slug, slug))
    .limit(1)

  if (!gym) notFound()

  return (
    <div className="min-h-svh bg-[#1B2845] flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">{gym.name}</h1>
          <p className="mt-2 text-sm text-[#BACFE0]">
            Ingresá tu número de documento para registrar tu ingreso.
          </p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-lg">
          <PublicCheckInForm slug={gym.slug} gymName={gym.name} />
        </div>
        <p className="text-center text-xs text-[#335C81]">
          Dispositivo público — tu documento no se guarda en este navegador.
        </p>
        <p className="text-center text-xs text-[#335C81]">
          <Link href="/legal/privacidad" className="hover:text-[#BACFE0] transition-colors">
            Política de Privacidad
          </Link>
          {' · '}
          <Link href="/legal/terminos" className="hover:text-[#BACFE0] transition-colors">
            Términos
          </Link>
        </p>
      </div>
    </div>
  )
}
