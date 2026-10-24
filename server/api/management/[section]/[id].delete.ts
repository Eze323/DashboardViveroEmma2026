import { and, eq, isNull, sql } from 'drizzle-orm'
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
} from '../../../../src/db/schema'
import { useDrizzle } from '../../../utils/drizzle'
import { managementSections, parsePositiveId } from '../../../utils/management'
import { notDeleted } from '../../../utils/soft-delete'

function requireAffected(count: number): void {
  if (!count) throw createError({ statusCode: 404, statusMessage: 'No se encontró un registro activo para eliminar.' })
}

export default defineEventHandler(async (event) => {
  const section = getRouterParam(event, 'section') ?? ''
  if (!managementSections.includes(section as typeof managementSections[number])) {
    throw createError({ statusCode: 404, statusMessage: 'La sección solicitada no existe.' })
  }
  const routeId = getRouterParam(event, 'id')
  const id = section === 'zonas' ? 0 : parsePositiveId(routeId)
  const db = useDrizzle()
  const deletedAt = new Date()

  switch (section) {
    case 'productos': {
      // Transacción ACID: Elimina lógicamente el producto y sus precios derivados asociados
      await db.transaction(async (tx) => {
        const rows = await tx.update(products)
          .set({ deletedAt, archivedAt: deletedAt, updatedAt: deletedAt })
          .where(and(eq(products.id, id), notDeleted(products)))
          .returning({ id: products.id })
        requireAffected(rows.length)

        // Marcar precios de variantes y proveedor relacionados como eliminados
        await tx.update(plantPotPrices)
          .set({ deletedAt, archivedAt: deletedAt })
          .where(and(eq(plantPotPrices.productId, id), notDeleted(plantPotPrices)))

        await tx.update(supplierPrices)
          .set({ deletedAt, archivedAt: deletedAt })
          .where(and(eq(supplierPrices.productId, id), notDeleted(supplierPrices)))
      })
      break
    }

    case 'clientes': {
      const rows = await db.update(customers)
        .set({ deletedAt, archivedAt: deletedAt })
        .where(and(eq(customers.id, id), notDeleted(customers)))
        .returning({ id: customers.id })
      requireAffected(rows.length)
      break
    }

    case 'proveedores': {
      // Transacción ACID: Elimina lógicamente el proveedor y sus listas de precios
      await db.transaction(async (tx) => {
        const rows = await tx.update(suppliers)
          .set({ deletedAt, archivedAt: deletedAt })
          .where(and(eq(suppliers.id, id), notDeleted(suppliers)))
          .returning({ id: suppliers.id })
        requireAffected(rows.length)

        await tx.update(supplierPrices)
          .set({ deletedAt, archivedAt: deletedAt })
          .where(and(eq(supplierPrices.supplierId, id), notDeleted(supplierPrices)))
      })
      break
    }

    case 'precios-proveedor': {
      const rows = await db.update(supplierPrices)
        .set({ deletedAt, archivedAt: deletedAt })
        .where(and(eq(supplierPrices.id, id), notDeleted(supplierPrices)))
        .returning({ id: supplierPrices.id })
      requireAffected(rows.length)
      break
    }

    case 'precios-maceta': {
      const rows = await db.update(plantPotPrices)
        .set({ deletedAt, archivedAt: deletedAt })
        .where(and(eq(plantPotPrices.id, id), notDeleted(plantPotPrices)))
        .returning({ id: plantPotPrices.id })
      requireAffected(rows.length)
      break
    }

    case 'ubicaciones': {
      const rows = await db.update(locations)
        .set({ deletedAt, archivedAt: deletedAt, updatedAt: deletedAt })
        .where(and(eq(locations.id, id), notDeleted(locations)))
        .returning({ id: locations.id })
      requireAffected(rows.length)
      break
    }

    case 'zonas': {
      const zoneId = routeId!
      const rows = await db.update(zones)
        .set({ deletedAt, archivedAt: deletedAt, updatedAt: deletedAt })
        .where(and(eq(zones.id, zoneId), notDeleted(zones)))
        .returning({ id: zones.id })
      requireAffected(rows.length)
      break
    }

    case 'accesos': {
      const rows = await db.update(users)
        .set({ deletedAt })
        .where(and(eq(users.id, id), notDeleted(users)))
        .returning({ id: users.id })
      requireAffected(rows.length)
      break
    }

    case 'compras': {
      // Transacción ACID: Revertir stock del producto de forma atómica y marcar la compra como eliminada
      await db.transaction(async (tx) => {
        const [purchase] = await tx.select().from(purchases)
          .where(and(eq(purchases.id, id), notDeleted(purchases))).limit(1)
        if (!purchase) throw createError({ statusCode: 404, statusMessage: 'No se encontró una compra activa para eliminar.' })

        const updated = await tx.update(products).set({
          stock: sql`${products.stock} - ${purchase.quantity}`,
          updatedAt: deletedAt
        }).where(sql`${products.id} = ${purchase.productId} and ${products.stock} >= ${purchase.quantity}`).returning({ id: products.id })

        if (updated.length === 0) {
          throw createError({
            statusCode: 409,
            statusMessage: 'No se puede eliminar esta compra porque el stock actual ya no alcanza para revertirla.'
          })
        }

        await tx.update(purchases)
          .set({ deletedAt, archivedAt: deletedAt })
          .where(eq(purchases.id, id))
      })
      break
    }

    case 'ventas': {
      // Transacción ACID: Revertir stock de los productos vendidos y soft delete de la venta
      await db.transaction(async (tx) => {
        const [sale] = await tx.select().from(sales)
          .where(and(eq(sales.id, id), notDeleted(sales))).limit(1)
        if (!sale) throw createError({ statusCode: 404, statusMessage: 'No se encontró una venta activa.' })

        if (sale.cae || sale.billingStatus === 'billed') {
          throw createError({ statusCode: 409, statusMessage: 'Un comprobante fiscal emitido no se puede cancelar desde el panel.' })
        }
        if (sale.status === 'Cancelada' && sale.deletedAt !== null) {
          throw createError({ statusCode: 409, statusMessage: 'La venta ya fue cancelada y eliminada.' })
        }

        if (sale.inventoryAppliedAt !== null) {
          const items = await tx.select({ productId: saleItems.productId, quantity: saleItems.quantity })
            .from(saleItems).where(and(eq(saleItems.saleId, id), notDeleted(saleItems)))

          for (const item of items) {
            await tx.update(products).set({
              stock: sql`${products.stock} + ${item.quantity}`,
              updatedAt: deletedAt
            }).where(eq(products.id, item.productId))
          }
        }

        // Marcar líneas de venta como eliminadas
        await tx.update(saleItems)
          .set({ deletedAt, archivedAt: deletedAt })
          .where(eq(saleItems.saleId, id))

        // Soft delete de la venta
        await tx.update(sales).set({
          status: 'Cancelada',
          deletedAt,
          inventoryAppliedAt: null,
          updatedAt: deletedAt
        }).where(eq(sales.id, id))
      })
      break
    }

    case 'facturas':
      throw createError({ statusCode: 409, statusMessage: 'El comprobante se conserva junto a la venta. Para anularlo, usa la acción de cancelar venta si todavía no fue emitido fiscalmente.' })

    default:
      throw createError({ statusCode: 405, statusMessage: 'Esta sección se deriva de otros registros y no admite eliminación directa.' })
  }

  return { success: true, data: { id: routeId, deleted: true, archived: true } }
})
