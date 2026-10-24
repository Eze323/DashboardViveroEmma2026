import { and, eq, sql } from 'drizzle-orm'
import { getRouterParam } from 'h3'
import {
  customers,
  locations,
  plantPotPrices,
  products,
  purchases,
  saleItems,
  sales,
  supplierPrices,
  suppliers,
  users,
  zones
} from '../../../../../src/db/schema'
import { useDrizzle } from '../../../../utils/drizzle'
import { requireRole } from '../../../../utils/auth'
import { logAuditEvent } from '../../../../utils/audit'
import { managementSections, parsePositiveId } from '../../../../utils/management'
import { isDeleted } from '../../../../utils/soft-delete'

export default defineEventHandler(async (event) => {
  const section = getRouterParam(event, 'section') ?? ''
  if (!managementSections.includes(section as typeof managementSections[number])) {
    throw createError({ statusCode: 404, statusMessage: 'La sección solicitada no existe.' })
  }
  if (section === 'accesos' || section === 'productos') requireRole(event, 'admin')
  const routeId = getRouterParam(event, 'id')
  const id = section === 'zonas' ? 0 : parsePositiveId(routeId)
  const db = useDrizzle()

  const restored = await (async () => {
    switch (section) {
      case 'productos':
        return await db.transaction(async (tx) => {
          const updated = await tx.update(products)
            .set({ deletedAt: null, archivedAt: null, updatedAt: new Date() })
            .where(and(eq(products.id, id), isDeleted(products)))
            .returning({ id: products.id })
          if (updated.length === 0) return false

          // Restaurar también sus precios de maceta
          await tx.update(plantPotPrices)
            .set({ deletedAt: null, archivedAt: null })
            .where(eq(plantPotPrices.productId, id))

          return true
        })

      case 'clientes':
        return (await db.update(customers)
          .set({ deletedAt: null, archivedAt: null })
          .where(and(eq(customers.id, id), isDeleted(customers)))
          .returning({ id: customers.id })).length > 0

      case 'proveedores':
        return (await db.update(suppliers)
          .set({ deletedAt: null, archivedAt: null })
          .where(and(eq(suppliers.id, id), isDeleted(suppliers)))
          .returning({ id: suppliers.id })).length > 0

      case 'compras':
        return await db.transaction(async (tx) => {
          const [purchase] = await tx.select().from(purchases)
            .where(and(eq(purchases.id, id), isDeleted(purchases))).limit(1)
          if (!purchase) return false

          const [product] = await tx.select({ id: products.id }).from(products)
            .where(eq(products.id, purchase.productId)).limit(1)
          if (!product) throw createError({ statusCode: 409, statusMessage: 'No se puede restaurar la compra porque el producto ya no existe.' })

          await tx.update(products).set({
            stock: sql`${products.stock} + ${purchase.quantity}`,
            updatedAt: new Date()
          }).where(eq(products.id, purchase.productId))

          await tx.update(purchases)
            .set({ deletedAt: null, archivedAt: null })
            .where(eq(purchases.id, id))

          return true
        })

      case 'ventas':
        return await db.transaction(async (tx) => {
          const [sale] = await tx.select().from(sales)
            .where(and(eq(sales.id, id), isDeleted(sales))).limit(1)
          if (!sale) return false

          const items = await tx.select({ productId: saleItems.productId, quantity: saleItems.quantity })
            .from(saleItems).where(eq(saleItems.saleId, id))

          // Verificar stock suficiente antes de reactivar la venta
          for (const item of items) {
            const updated = await tx.update(products).set({
              stock: sql`${products.stock} - ${item.quantity}`,
              updatedAt: new Date()
            }).where(sql`${products.id} = ${item.productId} and ${products.stock} >= ${item.quantity}`).returning({ id: products.id })

            if (updated.length === 0) {
              const [prod] = await tx.select({ name: products.name, stock: products.stock }).from(products).where(eq(products.id, item.productId)).limit(1)
              throw createError({
                statusCode: 409,
                statusMessage: `No hay stock suficiente para restaurar la venta. Producto: "${prod?.name ?? item.productId}". Stock disponible: ${prod?.stock ?? 0}.`
              })
            }
          }

          // Restaurar las líneas de venta
          await tx.update(saleItems)
            .set({ deletedAt: null, archivedAt: null })
            .where(eq(saleItems.saleId, id))

          // Restaurar la venta
          await tx.update(sales).set({
            deletedAt: null,
            status: 'Completada',
            inventoryAppliedAt: new Date(),
            updatedAt: new Date()
          }).where(eq(sales.id, id))

          return true
        })

      case 'precios-proveedor':
        return (await db.update(supplierPrices)
          .set({ deletedAt: null, archivedAt: null })
          .where(and(eq(supplierPrices.id, id), isDeleted(supplierPrices)))
          .returning({ id: supplierPrices.id })).length > 0

      case 'precios-maceta':
        return (await db.update(plantPotPrices)
          .set({ deletedAt: null, archivedAt: null })
          .where(and(eq(plantPotPrices.id, id), isDeleted(plantPotPrices)))
          .returning({ id: plantPotPrices.id })).length > 0

      case 'ubicaciones':
        return (await db.update(locations)
          .set({ deletedAt: null, archivedAt: null, updatedAt: new Date() })
          .where(and(eq(locations.id, id), isDeleted(locations)))
          .returning({ id: locations.id })).length > 0

      case 'zonas': {
        const zoneId = routeId!
        return (await db.update(zones)
          .set({ deletedAt: null, archivedAt: null, updatedAt: new Date() })
          .where(and(eq(zones.id, zoneId), isDeleted(zones)))
          .returning({ id: zones.id })).length > 0
      }

      case 'accesos':
        return (await db.update(users)
          .set({ deletedAt: null })
          .where(and(eq(users.id, id), isDeleted(users)))
          .returning({ id: users.id })).length > 0

      default:
        throw createError({ statusCode: 405, statusMessage: 'Esta sección no admite restauración directa.' })
    }
  })()

  if (!restored) throw createError({ statusCode: 404, statusMessage: 'No se encontró un registro eliminado para restaurar.' })
  if (section === 'accesos' || section === 'productos' || section === 'compras' || section === 'ventas') {
    await logAuditEvent(event, {
      action: section === 'accesos'
        ? 'USER_RESTORED'
        : section === 'productos'
          ? 'PRODUCT_RESTORED'
          : 'STOCK_ADJUSTED',
      entity: section === 'accesos'
        ? 'users'
        : section === 'productos'
          ? 'products'
          : section,
      entityId: routeId ?? '',
      details: { before: { deleted: true }, after: { deleted: false } }
    })
  }
  return { success: true, data: { id: routeId, deleted: false, archived: false } }
})
