import { and, asc, eq } from 'drizzle-orm'
import { getRouterParam } from 'h3'
import { plantPotPrices, products } from '../../../../src/db/schema'
import { useDrizzle } from '../../../utils/drizzle'
import { parsePositiveId } from '../../../utils/management'
import { notDeleted } from '../../../utils/soft-delete'

export default defineEventHandler(async (event) => {
  const productId = parsePositiveId(getRouterParam(event, 'id'))
  const db = useDrizzle()
  const [product] = await db.select({
    id: products.id,
    name: products.name,
    sku: products.sku,
    stock: products.stock,
    price: products.salePrice,
    potSize: products.potSize,
    imageUrl: products.imageUrl
  }).from(products).where(and(eq(products.id, productId), notDeleted(products))).limit(1)

  if (!product) throw createError({ statusCode: 404, statusMessage: 'Producto no encontrado o eliminado.' })

  const variants = await db.select({
    id: plantPotPrices.id,
    size: plantPotPrices.potSize,
    price: plantPotPrices.price
  }).from(plantPotPrices).where(and(
    eq(plantPotPrices.productId, productId),
    notDeleted(plantPotPrices)
  )).orderBy(asc(plantPotPrices.potSize), asc(plantPotPrices.id))

  return {
    product: {
      id: String(product.id),
      nombre: product.name,
      sku: product.sku ?? '',
      stock: product.stock,
      precio: Number(product.price),
      imageUrl: product.imageUrl ?? ''
    },
    variants: variants.length
      ? variants.map(variant => ({ id: String(variant.id), size: variant.size, price: Number(variant.price) }))
      : [{ id: null, size: product.potSize ?? 'Tamaño estándar', price: Number(product.price) }]
  }
})
