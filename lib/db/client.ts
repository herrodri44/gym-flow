import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const databaseUrl = process.env.DATABASE_URL!
// The local Supabase stack (`supabase start`) doesn't serve TLS.
const isLocalDb = /@(127\.0\.0\.1|localhost)[:/]/.test(databaseUrl)

const client = postgres(databaseUrl, {
  max: process.env.NODE_ENV === 'development' ? 5 : 1,
  ssl: isLocalDb ? false : 'require',
  prepare: false, // required for Supabase transaction pooler
})

export const db = drizzle(client, { schema })
