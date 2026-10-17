import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '../../src/db/schema'

let client: ReturnType<typeof postgres> | undefined
let database: ReturnType<typeof drizzle<typeof schema>> | undefined

export function useDrizzle() {
  if (database) return database

  const { databaseUrl } = useRuntimeConfig()
  if (typeof databaseUrl !== 'string' || !databaseUrl) {
    throw createError({
      statusCode: 503,
      statusMessage: 'La conexión a PostgreSQL no está configurada.'
    })
  }

  client = postgres(databaseUrl, {
    prepare: false,
    connect_timeout: 10,
    max: 5,
    idle_timeout: 20
  })
  database = drizzle(client, { schema })

  return database
}
