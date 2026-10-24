import { getRequestIP } from 'h3'
import type { H3Event } from 'h3'
import { auditLogs } from '../../src/db/schema'
import { useDrizzle } from './drizzle'

export interface AuditEventInput {
  action: string
  entity: string
  entityId: string
  details: Record<string, unknown>
}

export async function logAuditEvent(event: H3Event, input: AuditEventInput): Promise<void> {
  const user = event.context.user
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'No se puede registrar la auditoría sin un usuario autenticado.'
    })
  }

  await useDrizzle().insert(auditLogs).values({
    userId: user.id,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    details: input.details,
    ipAddress: getRequestIP(event) ?? null
  })
}
