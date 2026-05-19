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
      <div className="flex items-center justify-between">
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
        <div className="rounded-lg border bg-white">
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
      )}
    </div>
  )
}
