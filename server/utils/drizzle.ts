import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '../../src/db/schema'
import { getServerEnvironment } from './server-environment'

let client: ReturnType<typeof postgres> | undefined
let database: ReturnType<typeof drizzle<typeof schema>> | undefined

export function useDrizzle() {
  if (database) return database

  const config = useRuntimeConfig()
  const environment = getServerEnvironment()
  const databaseUrl = config.databaseUrl
    || environment.NUXT_DATABASE_URL
    || environment.DATABASE_URL
    || environment.DIRECT_URL

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
