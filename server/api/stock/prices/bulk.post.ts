import { and, eq, isNull } from 'drizzle-orm'
import { readBody } from 'h3'
import { z } from 'zod'
import { categories, products, stockMovements } from '../../../../src/db/schema'
import { requireRole } from '../../../utils/auth'
import { logAuditEvent } from '../../../utils/audit'
import { useDrizzle } from '../../../utils/drizzle'

const bulkPriceInput = z.object({
  categoryId: z.coerce.number().int().positive().safe(),
  mode: z.enum(['percentage', 'fixed']),
  amount: z.coerce.number().finite()
    .min(-99999999.99)
    .max(99999999.99)
})

export default defineEventHandler(async (event) => {
  const actor = requireRole(event, 'admin', 'encargado')

  let input: z.infer<typeof bulkPriceInput>
  try {
    input = bulkPriceInput.parse(await readBody(event))
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw createError({ statusCode: 400, statusMessage: error.issues[0]?.message ?? 'El ajuste de precios no es válido.' })
    }
    throw error
  }
  if (input.mode === 'percentage' && (input.amount < -100 || input.amount > 10000)) {
    throw createError({ statusCode: 400, statusMessage: 'El ajuste porcentual debe estar entre -100% y 10.000%.' })
  }

  const db = useDrizzle()
  const updated = await db.transaction(async (tx) => {
    const [category] = await tx.select({ id: categories.id })
      .from(categories)
      .where(and(
        eq(categories.id, input.categoryId),
        isNull(categories.deletedAt),
        isNull(categories.archivedAt)
      ))
      .limit(1)
    if (!category) {
      throw createError({ statusCode: 404, statusMessage: 'No se encontró una categoría activa.' })
    }

    const rows = await tx.select({
      id: products.id,
      stock: products.stock,
      salePrice: products.salePrice
    }).from(products)
      .where(and(
        eq(products.categoryId, input.categoryId),
        isNull(products.deletedAt),
        isNull(products.archivedAt)
      ))
      .orderBy(products.id)
      .for('update')

    let updatedCount = 0
    for (const row of rows) {
      const currentPrice = Number(row.salePrice)
      const nextPrice = Math.round((
        input.mode === 'percentage'
          ? currentPrice * (1 + input.amount / 100)
          : currentPrice + input.amount
      ) * 100) / 100

      if (!Number.isFinite(nextPrice) || nextPrice < 0 || nextPrice > 99999999.99) {
        throw createError({ statusCode: 400, statusMessage: `El ajuste produciría un precio no válido para el producto ${row.id}.` })
      }
      if (nextPrice === currentPrice) continue

      await tx.update(products).set({
        salePrice: nextPrice.toFixed(2),
        updatedAt: new Date()
      }).where(eq(products.id, row.id))

      await tx.insert(stockMovements).values({
        productId: row.id,
        type: 'MANUAL_ADJUSTMENT',
        quantity: 0,
        previousStock: row.stock,
        newStock: row.stock,
        previousPrice: row.salePrice,
        newPrice: nextPrice.toFixed(2)
      })
      updatedCount++
    }
    return updatedCount
  })

  await logAuditEvent(event, {
    action: 'PRODUCT_UPDATED',
    entity: 'categories',
    entityId: String(input.categoryId),
    details: {
      userId: actor.id,
      adjustment: { mode: input.mode, amount: input.amount },
      productsUpdated: updated
    }
  })
  return { success: true, data: { updated } }
})
