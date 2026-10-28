import { and, eq, isNull } from 'drizzle-orm'
import { readBody } from 'h3'
import { z } from 'zod'
import { categories } from '../../src/db/schema'
import { requireRole } from '../utils/auth'
import { logAuditEvent } from '../utils/audit'
import { useDrizzle } from '../utils/drizzle'
import { isUniqueConstraintError } from '../utils/management'
import { invalidateManagementCategoriesCache } from '../utils/management-cache'

const categoryInput = z.object({
  nombre: z.string().trim().min(1).max(50),
  descripcion: z.string().trim().max(500).optional()
})

export default defineEventHandler(async (event) => {
  requireRole(event, 'admin', 'encargado')
  let input: z.infer<typeof categoryInput>
  try {
    input = categoryInput.parse(await readBody(event))
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw createError({ statusCode: 400, statusMessage: error.issues[0]?.message ?? 'Los datos enviados no son válidos.' })
    }
    throw error
  }

  const [existing] = await useDrizzle().select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.name, input.nombre), isNull(categories.deletedAt), isNull(categories.archivedAt)))
    .limit(1)
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Ya existe una categoría con ese nombre.' })
  }

  let category: { id: number, name: string } | undefined
  try {
    [category] = await useDrizzle().insert(categories).values({
      name: input.nombre,
      description: input.descripcion || null
    }).returning({ id: categories.id, name: categories.name })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw createError({ statusCode: 409, statusMessage: 'Ya existe una categoría con ese nombre.' })
    }
    console.error('Error al crear una categoría:', error)
    throw createError({ statusCode: 500, statusMessage: 'No se pudo crear la categoría.' })
  }

  if (!category) {
    throw createError({ statusCode: 500, statusMessage: 'No se pudo crear la categoría.' })
  }

  await invalidateManagementCategoriesCache()
  await logAuditEvent(event, {
    action: 'CATEGORY_CREATED',
    entity: 'categories',
    entityId: String(category.id),
    details: { before: null, after: category }
  })
  return { success: true, data: { id: String(category.id), nombre: category.name } }
})
