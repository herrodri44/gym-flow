// All data fetching is in lib/domain/superadmin.ts.
import { getAdminsPageData } from '@/lib/domain/superadmin'
import { CreateAdminDialog } from './_components/create-admin-dialog'
import { ResetPasswordDialog } from './_components/reset-password-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export default async function AdministradoresPage() {
  const { allGyms, admins } = await getAdminsPageData()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Administradores</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {admins.length}{' '}
            {admins.length === 1
              ? 'administrador registrado'
              : 'administradores registrados'}
          </p>
        </div>
        <CreateAdminDialog gyms={allGyms} />
      </div>

      {admins.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <p className="text-zinc-500">Todavía no hay administradores.</p>
          <p className="mt-1 text-sm text-zinc-400">
            Creá el primero con el botón de arriba.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Gimnasio asignado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((admin) => (
                <TableRow key={`${admin.id}-${admin.gymName}`}>
                  <TableCell className="font-medium">{admin.fullName}</TableCell>
                  <TableCell className="text-zinc-500">{admin.email}</TableCell>
                  <TableCell>
                    {admin.gymName ? (
                      <Badge variant="secondary">{admin.gymName}</Badge>
                    ) : (
                      <span className="text-zinc-400">Sin asignar</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <ResetPasswordDialog adminId={admin.id} adminName={admin.fullName} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
