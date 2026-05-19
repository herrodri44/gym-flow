import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const client = postgres(process.env.DATABASE_URL!, {
  max: process.env.NODE_ENV === 'development' ? 5 : 1,
  ssl: 'require',
  prepare: false, // required for Supabase transaction pooler
})

export const db = drizzle(client, { schema })
