export const ROLES = {
  SUPERADMIN: 'superadmin',
  GYM_ADMIN: 'gym_admin',
  MEMBER: 'member',
} as const

export type UserRole = (typeof ROLES)[keyof typeof ROLES]

export const ACTIVE_GYM_COOKIE = 'gym-flow-active-gym'

export const ROLE_HOME: Record<UserRole, string> = {
  superadmin: '/superadmin/gyms',
  gym_admin: '/admin/select-gym',
  member: '/portal/account',
}
