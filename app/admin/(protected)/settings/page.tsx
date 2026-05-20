import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { db } from '@/lib/db/client'
import { gyms, gymAdmins, gymSettings } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { ACTIVE_GYM_COOKIE } from '@/lib/auth/roles'
import QRCode from 'qrcode'
import { GymInfoForm } from './_components/gym-info-form'
import { OperationalSettingsForm } from './_components/operational-settings-form'
import { GymQR } from './_components/gym-qr'
import { ChangePasswordDialog } from './_components/change-password-dialog'
import { BulkMemberUpload } from './_components/bulk-member-upload'
import { Separator } from '@/components/ui/separator'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'gym_admin') redirect('/login')

  const cookieStore = await cookies()
  const gymId = cookieStore.get(ACTIVE_GYM_COOKIE)?.value
  if (!gymId) redirect('/admin/select-gym')

  const [assignment] = await db
    .select({ id: gymAdmins.id })
    .from(gymAdmins)
    .where(and(eq(gymAdmins.gymId, gymId), eq(gymAdmins.userId, user.id)))
    .limit(1)

  if (!assignment) redirect('/admin/select-gym')

  const [[gym], [settings]] = await Promise.all([
    db
      .select()
      .from(gyms)
      .where(eq(gyms.id, gymId))
      .limit(1),
    db
      .select()
      .from(gymSettings)
      .where(eq(gymSettings.gymId, gymId))
      .limit(1),
  ])

  if (!gym) redirect('/admin/select-gym')

  // Build the public check-in URL from the request host
  const headerStore = await headers()
  const host = headerStore.get('host') ?? 'localhost:3000'
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  const checkInUrl = `${protocol}://${host}/g/${gym.slug}`

  const qrDataUrl = await QRCode.toDataURL(checkInUrl, {
    width: 440,
    margin: 2,
    color: { dark: '#18181b', light: '#ffffff' },
  })

  return (
    <div className="space-y-10 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Configuración</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Información del gimnasio y opciones operativas.
        </p>
      </div>

      {/* Gym info */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-800">Información del gimnasio</h2>
        <GymInfoForm
          name={gym.name}
          address={gym.address}
          phone={gym.phone}
          email={gym.email}
          openingHours={gym.openingHours}
          timezone={gym.timezone}
        />
      </section>

      <Separator />

      {/* Operational settings */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-800">Configuración operativa</h2>
        <OperationalSettingsForm
          allowOverLimit={settings?.allowOverLimit ?? false}
          lowCreditsThreshold={settings?.lowCreditsThreshold ?? 2}
          autoGeneratePayments={settings?.autoGeneratePayments ?? true}
        />
      </section>

      <Separator />

      {/* QR code */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-800">QR de fichaje público</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Imprimí este código y colocalo en la puerta del gimnasio. Los socios lo escanean para
            fichar sin necesidad de iniciar sesión.
          </p>
        </div>
        <GymQR qrDataUrl={qrDataUrl} checkInUrl={checkInUrl} gymName={gym.name} />
      </section>

      <Separator />

      {/* Bulk import */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-800">Importar socios</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Cargá múltiples socios desde un archivo CSV. Los socios ya existentes (mismo DNI) se omiten automáticamente.
          </p>
        </div>
        <BulkMemberUpload />
      </section>

      <Separator />

      {/* Account */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-800">Cuenta</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Seguridad de tu cuenta de administrador.
          </p>
        </div>
        <ChangePasswordDialog />
      </section>
    </div>
  )
}
