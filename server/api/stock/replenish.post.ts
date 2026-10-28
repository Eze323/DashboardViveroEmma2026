import { and, eq, isNull, sql } from 'drizzle-orm'
import { readBody } from 'h3'
import { z } from 'zod'
import { products, stockMovements } from '../../../src/db/schema'
import { requireRole } from '../../utils/auth'
import { logAuditEvent } from '../../utils/audit'
import { useDrizzle } from '../../utils/drizzle'
import { invalidateManagementCategoriesCache } from '../../utils/management-cache'

const replenishmentInput = z.array(z.object({
  productId: z.coerce.number().int().positive().safe(),
  addedQuantity: z.coerce.number().int().positive().max(100000000),
  newPrice: z.coerce.number().finite().min(0).max(99999999.99).optional()
})).min(1).max(100).superRefine((items, context) => {
  const ids = new Set<number>()
  items.forEach((item, index) => {
    if (ids.has(item.productId)) {
      context.addIssue({
        code: 'custom',
        path: [index, 'productId'],
        message: 'No repitas un producto en la misma reposición.'
      })
    }
    ids.add(item.productId)
  })
})

export default defineEventHandler(async (event) => {
  const actor = requireRole(event, 'admin', 'encargado')

  let items: z.infer<typeof replenishmentInput>
  try {
    items = replenishmentInput.parse(await readBody(event))
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw createError({ statusCode: 400, statusMessage: error.issues[0]?.message ?? 'Los datos de reposición no son válidos.' })
    }
    throw error
  }

  const db = useDrizzle()
  await db.transaction(async (tx) => {
    for (const item of items) {
      const [before] = await tx.select({
        id: products.id,
        stock: products.stock,
        salePrice: products.salePrice
      }).from(products)
        .where(and(
          eq(products.id, item.productId),
          isNull(products.deletedAt),
          isNull(products.archivedAt)
        ))
        .for('update')

      if (!before) {
        throw createError({ statusCode: 404, statusMessage: `No se encontró el producto ${item.productId} o está archivado.` })
      }
      if (before.stock + item.addedQuantity > 100000000) {
        throw createError({ statusCode: 400, statusMessage: `La reposición supera el stock máximo permitido para el producto ${item.productId}.` })
      }

      const nextPrice = item.newPrice?.toFixed(2) ?? before.salePrice
      const [after] = await tx.update(products).set({
        stock: sql`${products.stock} + ${item.addedQuantity}`,
        ...(item.newPrice !== undefined ? { salePrice: nextPrice } : {}),
        updatedAt: new Date()
      }).where(eq(products.id, item.productId)).returning({
        stock: products.stock,
        salePrice: products.salePrice
      })

      if (!after) {
        throw createError({ statusCode: 409, statusMessage: `No se pudo actualizar el producto ${item.productId}.` })
      }

      await tx.insert(stockMovements).values({
        productId: item.productId,
        type: 'REBOOT_IN',
        quantity: item.addedQuantity,
        previousStock: before.stock,
        newStock: after.stock,
        previousPrice: before.salePrice,
        newPrice: after.salePrice
      })
    }
  })

  await invalidateManagementCategoriesCache()
  await logAuditEvent(event, {
    action: 'STOCK_ADJUSTED',
    entity: 'products',
    entityId: 'bulk-replenishment',
    details: {
      userId: actor.id,
      items: items.map(item => ({
        productId: item.productId,
        addedQuantity: item.addedQuantity,
        newPrice: item.newPrice
      }))
    }
  })
  return { success: true, data: { updated: items.length } }
})
