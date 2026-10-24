import { db } from '@/lib/db/client'
import { members, memberStanding, visits, type MemberStandingStatus } from '@/lib/db/schema'
import { and, asc, count, eq, exists, gt, ilike, inArray, max, not, or, sql } from 'drizzle-orm'
import { addDays } from './period-math'
import { RECENT_VISIT_DAYS } from './activity'

export const MEMBERS_PAGE_SIZE = 25

// 'lapsed' = grace or expired (what the dashboard calls "Vencidos").
const standingFilters = ['active', 'grace', 'expired', 'lapsed', 'no_plan'] as const
const seenFilters = ['recent', 'away'] as const

export type MembersListFilters = {
  q: string
  status: 'active' | 'inactive' | 'all'
  /** Membership standing filter ("Cuota" in the UI). */
  payment: 'all' | (typeof standingFilters)[number]
  /** Attendance: visited in the last RECENT_VISIT_DAYS ('recent') or not ('away'). */
  seen: 'all' | (typeof seenFilters)[number]
  page: number
}

export type MemberRow = {
  id: string
  fullName: string
  documentNumber: string
  phone: string | null
  email: string | null
  birthDate: string | null
  joinedAt: string | null
  active: boolean
  notes: string | null
  standing: MemberStandingStatus
  planName: string | null
  planType: 'credits' | 'unlimited' | null
  /** null = unlimited plan or no period */
  creditsLeft: number | null
  /** Last valid day of the reference period */
  validUntil: string | null
  daysSinceExpiry: number | null
  lastVisit: Date | null
}

export type MembersListData = {
  rows: MemberRow[]
  total: number
  totalPages: number
}

export function parseStandingFilter(value: string | undefined): MembersListFilters['payment'] {
  return standingFilters.includes(value as (typeof standingFilters)[number])
    ? (value as MembersListFilters['payment'])
    : 'all'
}

export function parseSeenFilter(value: string | undefined): MembersListFilters['seen'] {
  return seenFilters.includes(value as (typeof seenFilters)[number])
    ? (value as MembersListFilters['seen'])
    : 'all'
}

export async function getMembersList(
  gymId: string,
  filters: MembersListFilters,
): Promise<MembersListData> {
  const { q, status, payment, seen, page } = filters

  const visitedRecently = exists(
    db
      .select({ one: visits.id })
      .from(visits)
      .where(
        and(
          eq(visits.memberId, members.id),
          gt(visits.visitDate, sql`${memberStanding.today} - ${RECENT_VISIT_DAYS}::int`),
        ),
      ),
  )

  const where = and(
    eq(members.gymId, gymId),
    status === 'inactive' ? eq(members.active, false) : status === 'all' ? undefined : eq(members.active, true),
    q ? or(ilike(members.fullName, `%${q}%`), ilike(members.documentNumber, `%${q}%`)) : undefined,
    payment === 'lapsed'
      ? inArray(memberStanding.status, ['grace', 'expired'])
      : payment !== 'all'
        ? eq(memberStanding.status, payment)
        : undefined,
    seen === 'recent' ? visitedRecently : seen === 'away' ? not(visitedRecently) : undefined,
  )

  // Round trip 1: total count and the page of members with their standing.
  const [[{ total }], memberRows] = await Promise.all([
    db
      .select({ total: count() })
      .from(members)
      .innerJoin(memberStanding, eq(memberStanding.memberId, members.id))
      .where(where),

    db
      .select({
        id: members.id,
        fullName: members.fullName,
        documentNumber: members.documentNumber,
        phone: members.phone,
        email: members.email,
        birthDate: members.birthDate,
        joinedAt: members.joinedAt,
        active: members.active,
        notes: members.notes,
        standing: memberStanding.status,
        planName: memberStanding.planName,
        planType: memberStanding.planType,
        creditsLeft: memberStanding.creditsLeft,
        endDate: memberStanding.endDate,
        daysSinceExpiry: memberStanding.daysSinceExpiry,
      })
      .from(members)
      .innerJoin(memberStanding, eq(memberStanding.memberId, members.id))
      .where(where)
      .orderBy(asc(members.fullName))
      .limit(MEMBERS_PAGE_SIZE)
      .offset((page - 1) * MEMBERS_PAGE_SIZE),
  ])

  // Round trip 2: last visit for the members on this page.
  const memberIds = memberRows.map((r) => r.id)
  const lastVisitRows =
    memberIds.length > 0
      ? await db
          .select({ memberId: visits.memberId, lastVisit: max(visits.visitedAt) })
          .from(visits)
          .where(and(inArray(visits.memberId, memberIds), eq(visits.gymId, gymId)))
          .groupBy(visits.memberId)
      : []
  const lastVisitMap = new Map(lastVisitRows.map((v) => [v.memberId, v.lastVisit]))

  const rows: MemberRow[] = memberRows.map(({ endDate, ...m }) => ({
    ...m,
    validUntil: endDate ? addDays(endDate, -1) : null,
    lastVisit: lastVisitMap.get(m.id) ?? null,
  }))

  return {
    rows,
    total: Number(total),
    totalPages: Math.ceil(Number(total) / MEMBERS_PAGE_SIZE),
  }
}
