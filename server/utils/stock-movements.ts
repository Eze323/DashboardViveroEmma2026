import { eq, sql } from 'drizzle-orm'
import { products, stockMovements } from '../../src/db/schema'
import type { stockMovementTypeEnum } from '../../src/db/schema'
import type { useDrizzle } from './drizzle'

type DrizzleTransaction = Parameters<Parameters<ReturnType<typeof useDrizzle>['transaction']>[0]>[0]
type StockMovementType = typeof stockMovementTypeEnum.enumValues[number]

export async function applyStockDelta(
  tx: DrizzleTransaction,
  productId: number,
  quantity: number,
  type: StockMovementType
) {
  const [before] = await tx.select({
    name: products.name,
    stock: products.stock,
    salePrice: products.salePrice
  }).from(products).where(eq(products.id, productId)).for('update')

  if (!before) {
    throw createError({ statusCode: 404, statusMessage: 'No se encontró el producto para actualizar el inventario.' })
  }
  if (before.stock + quantity < 0) {
    throw createError({ statusCode: 409, statusMessage: `Stock insuficiente para "${before.name}". Disponible: ${before.stock}.` })
  }

  const [after] = await tx.update(products).set({
    stock: sql`${products.stock} + ${quantity}`,
    updatedAt: new Date()
  }).where(eq(products.id, productId)).returning({
    stock: products.stock,
    salePrice: products.salePrice
  })

  if (!after) {
    throw createError({ statusCode: 409, statusMessage: 'No se pudo actualizar el inventario del producto.' })
  }

  await tx.insert(stockMovements).values({
    productId,
    type,
    quantity,
    previousStock: before.stock,
    newStock: after.stock,
    previousPrice: before.salePrice,
    newPrice: after.salePrice
  })

  return { before, after }
}
