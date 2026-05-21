import { cookies } from 'next/headers'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { membershipPlans } from '@/lib/db/schema'
import { ACTIVE_GYM_COOKIE } from '@/lib/auth/roles'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn, formatARS } from '@/lib/utils'
import { CreatePlanDialog } from './_components/create-plan-dialog'
import { PlanActionsMenu } from './_components/plan-actions-menu'

export default async function PlansPage() {
  const cookieStore = await cookies()
  const gymId = cookieStore.get(ACTIVE_GYM_COOKIE)!.value

  const plans = await db
    .select()
    .from(membershipPlans)
    .where(eq(membershipPlans.gymId, gymId))
    .orderBy(asc(membershipPlans.name))

  const activePlans = plans.filter((p) => p.active)
  const inactivePlans = plans.filter((p) => !p.active)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Planes</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {activePlans.length} {activePlans.length === 1 ? 'plan activo' : 'planes activos'}
          </p>
        </div>
        <CreatePlanDialog />
      </div>

      {plans.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <p className="text-zinc-500">No hay planes creados todavía.</p>
          <p className="mt-1 text-sm text-zinc-400">Creá un plan para poder inscribir socios.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Mobile: card list */}
          <div className="sm:hidden space-y-2">
            {[...activePlans, ...inactivePlans].map((plan) => (
              <div
                key={plan.id}
                className={cn('rounded-lg border bg-white px-4 py-3 space-y-2', !plan.active && 'opacity-50')}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{plan.name}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {plan.planType === 'unlimited'
                        ? 'Libre · acceso ilimitado'
                        : `Por créditos · ${plan.creditsPerMonth} créd./mes`}
                    </p>
                  </div>
                  <PlanActionsMenu
                    plan={{
                      id: plan.id,
                      name: plan.name,
                      planType: plan.planType,
                      priceArs: plan.priceArs,
                      creditsPerMonth: plan.creditsPerMonth,
                      description: plan.description,
                      active: plan.active,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold tabular-nums">{formatARS(plan.priceArs)}</span>
                  <Badge variant={plan.active ? 'default' : 'secondary'}>
                    {plan.active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
                {plan.description && (
                  <p className="truncate text-xs text-zinc-400">{plan.description}</p>
                )}
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block rounded-lg border bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Precio / mes</TableHead>
                  <TableHead className="text-center">Créditos / mes</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...activePlans, ...inactivePlans].map((plan) => (
                  <TableRow key={plan.id} className={!plan.active ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">{plan.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {plan.planType === 'unlimited' ? 'Libre' : 'Por créditos'}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">{formatARS(plan.priceArs)}</TableCell>
                    <TableCell className="text-center tabular-nums">
                      {plan.planType === 'unlimited' ? (
                        <span className="text-zinc-400">∞</span>
                      ) : (
                        plan.creditsPerMonth
                      )}
                    </TableCell>
                    <TableCell className="text-zinc-500 max-w-xs truncate">
                      {plan.description ?? '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={plan.active ? 'default' : 'secondary'}>
                        {plan.active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <PlanActionsMenu
                        plan={{
                          id: plan.id,
                          name: plan.name,
                          planType: plan.planType,
                          priceArs: plan.priceArs,
                          creditsPerMonth: plan.creditsPerMonth,
                          description: plan.description,
                          active: plan.active,
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
