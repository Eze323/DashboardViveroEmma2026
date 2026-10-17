import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { getRouterParam } from 'h3'
import { customers, locations, plantPotPrices, products, purchases, supplierPrices, suppliers, zones } from '../../../../../src/db/schema'
import { useDrizzle } from '../../../../utils/drizzle'
import { managementSections, parsePositiveId } from '../../../../utils/management'

export default defineEventHandler(async (event) => {
  const section = getRouterParam(event, 'section') ?? ''
  if (!managementSections.includes(section as typeof managementSections[number])) {
    throw createError({ statusCode: 404, statusMessage: 'La sección solicitada no existe.' })
  }
  const routeId = getRouterParam(event, 'id')
  const id = section === 'zonas' ? 0 : parsePositiveId(routeId)
  const db = useDrizzle()

  const restored = await (async () => {
    switch (section) {
      case 'productos':
        return (await db.update(products).set({ archivedAt: null, updatedAt: new Date() })
          .where(and(eq(products.id, id), isNotNull(products.archivedAt))).returning({ id: products.id })).length > 0
      case 'clientes':
        return (await db.update(customers).set({ archivedAt: null })
          .where(and(eq(customers.id, id), isNotNull(customers.archivedAt))).returning({ id: customers.id })).length > 0
      case 'proveedores':
        return (await db.update(suppliers).set({ archivedAt: null })
          .where(and(eq(suppliers.id, id), isNotNull(suppliers.archivedAt))).returning({ id: suppliers.id })).length > 0
      case 'compras':
        return await db.transaction(async (tx) => {
          const [purchase] = await tx.select().from(purchases)
            .where(and(eq(purchases.id, id), isNotNull(purchases.archivedAt))).limit(1)
          if (!purchase) return false
          const [product] = await tx.select({ id: products.id }).from(products).where(eq(products.id, purchase.productId)).limit(1)
          if (!product) throw createError({ statusCode: 409, statusMessage: 'No se puede restaurar la compra porque el producto no existe.' })
          await tx.update(products).set({ stock: sql`${products.stock} + ${purchase.quantity}`, updatedAt: new Date() })
            .where(eq(products.id, purchase.productId))
          await tx.update(purchases).set({ archivedAt: null }).where(eq(purchases.id, id))
          return true
        })
      case 'precios-proveedor':
        return (await db.update(supplierPrices).set({ archivedAt: null })
          .where(and(eq(supplierPrices.id, id), isNotNull(supplierPrices.archivedAt))).returning({ id: supplierPrices.id })).length > 0
      case 'precios-maceta':
        return (await db.update(plantPotPrices).set({ archivedAt: null })
          .where(and(eq(plantPotPrices.id, id), isNotNull(plantPotPrices.archivedAt))).returning({ id: plantPotPrices.id })).length > 0
      case 'ubicaciones':
        return (await db.update(locations).set({ archivedAt: null, updatedAt: new Date() })
          .where(and(eq(locations.id, id), isNotNull(locations.archivedAt))).returning({ id: locations.id })).length > 0
      case 'zonas': {
        const zoneId = routeId!
        return (await db.update(zones).set({ archivedAt: null, updatedAt: new Date() })
          .where(and(eq(zones.id, zoneId), isNotNull(zones.archivedAt))).returning({ id: zones.id })).length > 0
      }
      default:
        throw createError({ statusCode: 405, statusMessage: 'Esta sección no admite restauración directa.' })
    }
  })()

  if (!restored) throw createError({ statusCode: 404, statusMessage: 'No se encontró un registro archivado para restaurar.' })
  return { success: true, data: { id: routeId, archived: false } }
})
