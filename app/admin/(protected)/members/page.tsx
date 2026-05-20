// Auth lives in the layout; all data fetching is in lib/domain/members-list.ts.
import { cookies } from 'next/headers'
import { getMembersList } from '@/lib/domain/members-list'
import type { MembersListFilters } from '@/lib/domain/members-list'
import { ACTIVE_GYM_COOKIE } from '@/lib/auth/roles'
import { CreateMemberDialog } from './_components/create-member-dialog'
import { MembersSplitPanel } from './_components/members-split-panel'

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const sp = await searchParams
  const filters: MembersListFilters = {
    q: typeof sp.q === 'string' ? sp.q.trim() : '',
    status: (typeof sp.status === 'string' ? sp.status : 'active') as MembersListFilters['status'],
    payment: (typeof sp.payment === 'string' ? sp.payment : 'all') as MembersListFilters['payment'],
    page: Math.max(1, Number(typeof sp.page === 'string' ? sp.page : '1') || 1),
  }

  const cookieStore = await cookies()
  const gymId = cookieStore.get(ACTIVE_GYM_COOKIE)!.value

  const { rows, total, totalPages } = await getMembersList(gymId, filters)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Socios</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {total} {total === 1 ? 'socio' : 'socios'}
          </p>
        </div>
        <CreateMemberDialog />
      </div>

      <MembersSplitPanel rows={rows} filters={filters} total={total} totalPages={totalPages} />
    </div>
  )
}
