// All data fetching is in lib/domain/superadmin.ts.
import { getGymsPageData } from '@/lib/domain/superadmin'
import { CreateGymDialog } from './_components/create-gym-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export default async function GimnasiosPage() {
  const rows = await getGymsPageData()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Gimnasios</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {rows.length} {rows.length === 1 ? 'gimnasio registrado' : 'gimnasios registrados'}
          </p>
        </div>
        <CreateGymDialog />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <p className="text-zinc-500">Todavía no hay gimnasios.</p>
          <p className="mt-1 text-sm text-zinc-400">
            Creá el primero con el botón de arriba.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="sm:hidden space-y-2">
            {rows.map((gym) => (
              <div key={gym.id} className="rounded-lg border bg-white px-4 py-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm">{gym.name}</p>
                  <Badge variant="secondary">{gym.slug}</Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>{gym.timezone}</span>
                  <span>{gym.adminCount} {gym.adminCount === 1 ? 'admin' : 'admins'}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Zona horaria</TableHead>
                  <TableHead className="text-center">Admins</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((gym) => (
                  <TableRow key={gym.id}>
                    <TableCell className="font-medium">{gym.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{gym.slug}</Badge>
                    </TableCell>
                    <TableCell className="text-zinc-500">{gym.timezone}</TableCell>
                    <TableCell className="text-center">{gym.adminCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
