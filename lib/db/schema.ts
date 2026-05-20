import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  date,
  unique,
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

export const paymentStatusEnum = pgEnum('payment_status', [
  'paid',
  'pending',
  'overdue',
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

export const enrollments = pgTable('enrollments', {
  id: uuid('id').defaultRandom().primaryKey(),
  gymId: uuid('gym_id')
    .notNull()
    .references(() => gyms.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id')
    .notNull()
    .references(() => members.id, { onDelete: 'cascade' }),
  planId: uuid('plan_id')
    .notNull()
    .references(() => membershipPlans.id),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  active: boolean('active').notNull().default(true),
})

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

// ─── Franja 6 ─────────────────────────────────────────────────────────────────

export const paymentRecords = pgTable('payment_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  gymId: uuid('gym_id')
    .notNull()
    .references(() => gyms.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id')
    .notNull()
    .references(() => members.id, { onDelete: 'cascade' }),
  enrollmentId: uuid('enrollment_id').references(() => enrollments.id),
  amountArs: integer('amount_ars').notNull(), // centavos ARS
  currency: text('currency').notNull().default('ARS'),
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  status: paymentStatusEnum('status').notNull().default('pending'),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  notes: text('notes'),
  // Campos reservados para Stripe (nulos en MVP)
  provider: text('provider'),
  providerSubscriptionId: text('provider_subscription_id'),
  providerInvoiceId: text('provider_invoice_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Types ────────────────────────────────────────────────────────────────────

export type Gym = typeof gyms.$inferSelect
export type Profile = typeof profiles.$inferSelect
export type GymAdmin = typeof gymAdmins.$inferSelect
export type GymSettings = typeof gymSettings.$inferSelect
export type Member = typeof members.$inferSelect
export type MembershipPlan = typeof membershipPlans.$inferSelect
export type Enrollment = typeof enrollments.$inferSelect
export type Visit = typeof visits.$inferSelect
export type CreditAdjustment = typeof creditAdjustments.$inferSelect
export type PaymentRecord = typeof paymentRecords.$inferSelect
