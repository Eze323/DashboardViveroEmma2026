import { and, eq, isNull, sql } from 'drizzle-orm'
import { plantPotPrices, products } from '../../src/db/schema'
import type { useDrizzle } from './drizzle'

type Transaction = Parameters<Parameters<ReturnType<typeof useDrizzle>['transaction']>[0]>[0]

export interface SaleLineInput {
  productId: number
  quantity: number
  potSize?: string
}

export interface PricedSaleLine {
  productId: number
  quantity: number
  potSize: string | null
  unitPrice: string
}

export async function priceSaleLines(tx: Transaction, items: SaleLineInput[]): Promise<PricedSaleLine[]> {
  const lines: PricedSaleLine[] = []
  for (const item of items) {
    const [product] = await tx.select({
      id: products.id,
      name: products.name,
      salePrice: products.salePrice,
      potSize: products.potSize
    }).from(products).where(and(eq(products.id, item.productId), isNull(products.archivedAt))).limit(1)
    if (!product) throw createError({ statusCode: 400, statusMessage: 'Uno de los productos no existe o está archivado.' })

    const [variant] = item.potSize
      ? await tx.select({ price: plantPotPrices.price }).from(plantPotPrices).where(and(
          eq(plantPotPrices.productId, item.productId),
          eq(plantPotPrices.potSize, item.potSize),
          isNull(plantPotPrices.archivedAt)
        )).limit(1)
      : []
    const [variantCount] = await tx.select({ total: sql<number>`count(*)::int` }).from(plantPotPrices)
      .where(and(eq(plantPotPrices.productId, item.productId), isNull(plantPotPrices.archivedAt)))

    if (item.potSize && !variant && (variantCount?.total ?? 0) > 0) {
      throw createError({ statusCode: 400, statusMessage: `El tamaño "${item.potSize}" no tiene un precio activo para "${product.name}".` })
    }
    if (item.potSize && !variant && product.potSize && item.potSize !== product.potSize) {
      throw createError({ statusCode: 400, statusMessage: `El tamaño "${item.potSize}" no tiene un precio configurado para "${product.name}".` })
    }
    if (item.potSize && !variant && !product.potSize && !(variantCount?.total ?? 0) && item.potSize !== 'Tamaño estándar') {
      throw createError({ statusCode: 400, statusMessage: `El tamaño "${item.potSize}" no tiene un precio configurado para "${product.name}".` })
    }
    if (!item.potSize && (variantCount?.total ?? 0) > 0) {
      throw createError({ statusCode: 400, statusMessage: `Selecciona el tamaño de maceta para "${product.name}".` })
    }

    lines.push({
      productId: item.productId,
      quantity: item.quantity,
      potSize: item.potSize ?? product.potSize,
      unitPrice: Number(variant?.price ?? product.salePrice).toFixed(2)
    })
  }
  return lines
}
