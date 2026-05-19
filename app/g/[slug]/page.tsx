import { notFound } from 'next/navigation'
import { db } from '@/lib/db/client'
import { gyms } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { PublicCheckInForm } from './_components/public-check-in-form'

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
    <div className="min-h-screen bg-zinc-50 flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-900">{gym.name}</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Ingresá tu número de documento para registrar tu ingreso al gimnasio.
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <PublicCheckInForm slug={gym.slug} gymName={gym.name} />
        </div>
        <p className="text-center text-xs text-zinc-400">
          Este es un dispositivo público. Tu documento no se guarda en este navegador.
        </p>
      </div>
    </div>
  )
}
