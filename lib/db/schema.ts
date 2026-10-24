import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  date,
  smallint,
  unique,
  pgView,
} from 'drizzle-orm/pg-core'

// ─── Enums ────────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', [
  'superadmin',
  'gym_admin',
  'member',
])

export const planTypeEnum = pgEnum('plan_type', [
  'credits',
  'unlimited',
])

export const visitChannelEnum = pgEnum('visit_channel', [
  'fichaje_admin',
  'fichaje_public',
  'staff_manual',
])

// ─── Franja 1 ─────────────────────────────────────────────────────────────────

export const gyms = pgTable('gyms', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  timezone: text('timezone').notNull().default('America/Argentina/Buenos_Aires'),
  address: text('address'),
  phone: text('phone'),
  email: text('email'),
  openingHours: text('opening_hours'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(), // mismo id que auth.users.id
  role: userRoleEnum('role').notNull(),
  fullName: text('full_name').notNull(),
  email: text('email').notNull(),
  termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const gymAdmins = pgTable('gym_admins', {
  id: uuid('id').defaultRandom().primaryKey(),
  gymId: uuid('gym_id')
    .notNull()
    .references(() => gyms.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique().on(table.gymId, table.userId),
])

export const gymSettings = pgTable('gym_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  gymId: uuid('gym_id')
    .notNull()
    .references(() => gyms.id, { onDelete: 'cascade' })
    .unique(),
  allowOverLimit: boolean('allow_over_limit').notNull().default(false),
  lowCreditsThreshold: integer('low_credits_threshold').notNull().default(2),
  // Days after a period ends during which the member can still check in (B5).
  graceDays: integer('grace_days').notNull().default(0),
  // Day the gym switched to periods: grace never starts before it (migration 0006).
  billingCutoverDate: date('billing_cutover_date').notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Franja 2-3 ───────────────────────────────────────────────────────────────

export const members = pgTable('members', {
  id: uuid('id').defaultRandom().primaryKey(),
  gymId: uuid('gym_id')
    .notNull()
    .references(() => gyms.id, { onDelete: 'cascade' }),
  documentNumber: text('document_number').notNull(),
  fullName: text('full_name').notNull(),
  phone: text('phone'),
  email: text('email'),
  birthDate: date('birth_date'),
  joinedAt: date('joined_at'),
  userId: uuid('user_id').references(() => profiles.id), // null si no usa portal
  active: boolean('active').notNull().default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique().on(table.gymId, table.documentNumber),
])

export const membershipPlans = pgTable('membership_plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  gymId: uuid('gym_id')
    .notNull()
    .references(() => gyms.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  planType: planTypeEnum('plan_type').notNull().default('credits'),
  priceArs: integer('price_ars').notNull(), // centavos ARS
  creditsPerMonth: integer('credits_per_month'), // null cuando plan_type = 'unlimited'
  active: boolean('active').notNull().default(true),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// Legacy: `enrollments` still exists in the DB (read only by migration 0006)
// and is dropped once the billing cutover is verified. A member's plan is now
// the plan of their latest membership period.

// ─── Franja 4 ─────────────────────────────────────────────────────────────────

export const visits = pgTable('visits', {
  id: uuid('id').defaultRandom().primaryKey(),
  gymId: uuid('gym_id')
    .notNull()
    .references(() => gyms.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id')
    .notNull()
    .references(() => members.id, { onDelete: 'cascade' }),
  visitedAt: timestamp('visited_at', { withTimezone: true }).notNull(),
  // Gym-local calendar date; UNIQUE(member_id, visit_date) enforces one visit per day.
  visitDate: date('visit_date').notNull(),
  // The period this visit consumed a credit from. Null for grace visits until
  // the next payment attaches them (B5).
  periodId: uuid('period_id').references(() => membershipPeriods.id, { onDelete: 'set null' }),
  channel: visitChannelEnum('channel').notNull(),
  overLimit: boolean('over_limit').notNull().default(false),
  recordedBy: uuid('recorded_by').references(() => profiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const creditAdjustments = pgTable('credit_adjustments', {
  id: uuid('id').defaultRandom().primaryKey(),
  gymId: uuid('gym_id')
    .notNull()
    .references(() => gyms.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id')
    .notNull()
    .references(() => members.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(), // positivo = crédito a favor, negativo = en contra
  date: date('date').notNull(),
  recordedBy: uuid('recorded_by')
    .notNull()
    .references(() => profiles.id),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Billing ──────────────────────────────────────────────────────────────────

// Money actually received. Legacy columns (period_start, period_end, status,
// enrollment_id) still exist in the DB as nullable and are no longer read.
export const paymentRecords = pgTable('payment_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  gymId: uuid('gym_id')
    .notNull()
    .references(() => gyms.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id')
    .notNull()
    .references(() => members.id, { onDelete: 'cascade' }),
  amountArs: integer('amount_ars').notNull(), // centavos ARS
  currency: text('currency').notNull().default('ARS'),
  paidAt: timestamp('paid_at', { withTimezone: true }).notNull(),
  notes: text('notes'),
  // Reserved for an online payment provider (null in MVP)
  provider: text('provider'),
  providerSubscriptionId: text('provider_subscription_id'),
  providerInvoiceId: text('provider_invoice_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// What a payment entitles: [startDate, endDate) in gym-local dates, with a
// snapshot of the plan (B7). Overlaps are rejected by an EXCLUDE constraint.
export const membershipPeriods = pgTable('membership_periods', {
  id: uuid('id').defaultRandom().primaryKey(),
  gymId: uuid('gym_id')
    .notNull()
    .references(() => gyms.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id')
    .notNull()
    .references(() => members.id, { onDelete: 'cascade' }),
  paymentId: uuid('payment_id')
    .notNull()
    .unique()
    .references(() => paymentRecords.id, { onDelete: 'cascade' }),
  planId: uuid('plan_id')
    .notNull()
    .references(() => membershipPlans.id),
  planType: planTypeEnum('plan_type').notNull(),
  creditsGranted: integer('credits_granted'), // null when plan_type = 'unlimited'
  priceArs: integer('price_ars').notNull(), // centavos ARS
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(), // exclusive
  anchorDay: smallint('anchor_day').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const memberStandingStatus = ['active', 'grace', 'expired', 'no_plan', 'not_started'] as const
export type MemberStandingStatus = (typeof memberStandingStatus)[number]

// View defined in migration 0006. One row per member: the reference period
// (current, else latest started, else earliest upcoming) plus derived status
// and credits. The single source of truth for "can this member train".
export const memberStanding = pgView('member_standing', {
  memberId: uuid('member_id').notNull(),
  gymId: uuid('gym_id').notNull(),
  memberActive: boolean('member_active').notNull(),
  today: date('today').notNull(),
  graceDays: integer('grace_days').notNull(),
  allowOverLimit: boolean('allow_over_limit').notNull(),
  periodId: uuid('period_id'),
  planId: uuid('plan_id'),
  planName: text('plan_name'),
  planType: planTypeEnum('plan_type'),
  creditsGranted: integer('credits_granted'),
  priceArs: integer('price_ars'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  anchorDay: smallint('anchor_day'),
  creditsUsed: integer('credits_used').notNull(),
  creditsAdjusted: integer('credits_adjusted').notNull(),
  creditsLeft: integer('credits_left'),
  graceVisits: integer('grace_visits').notNull(),
  status: text('status', { enum: memberStandingStatus }).notNull(),
  daysLeft: integer('days_left'),
  daysSinceExpiry: integer('days_since_expiry'),
  graceDaysLeft: integer('grace_days_left'),
  hasUpcoming: boolean('has_upcoming').notNull(),
}).existing()

// ─── Types ────────────────────────────────────────────────────────────────────

export type Gym = typeof gyms.$inferSelect
export type Profile = typeof profiles.$inferSelect
export type GymAdmin = typeof gymAdmins.$inferSelect
export type GymSettings = typeof gymSettings.$inferSelect
export type Member = typeof members.$inferSelect
export type MembershipPlan = typeof membershipPlans.$inferSelect
export type Visit = typeof visits.$inferSelect
export type CreditAdjustment = typeof creditAdjustments.$inferSelect
export type PaymentRecord = typeof paymentRecords.$inferSelect
export type MembershipPeriod = typeof membershipPeriods.$inferSelect
