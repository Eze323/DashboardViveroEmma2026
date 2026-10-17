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
  zones
} from '../../../../src/db/schema'
import { useDrizzle } from '../../../utils/drizzle'
import { managementSections, parsePositiveId } from '../../../utils/management'

function requireAffected(count: number): void {
  if (!count) throw createError({ statusCode: 404, statusMessage: 'No se encontró un registro activo para archivar.' })
}

export default defineEventHandler(async (event) => {
  const section = getRouterParam(event, 'section') ?? ''
  if (!managementSections.includes(section as typeof managementSections[number])) {
    throw createError({ statusCode: 404, statusMessage: 'La sección solicitada no existe.' })
  }
  const routeId = getRouterParam(event, 'id')
  const id = section === 'zonas' ? 0 : parsePositiveId(routeId)
  const db = useDrizzle()
  const archivedAt = new Date()

  switch (section) {
    case 'productos': {
      const rows = await db.update(products).set({ archivedAt, updatedAt: archivedAt })
        .where(and(eq(products.id, id), isNull(products.archivedAt))).returning({ id: products.id })
      requireAffected(rows.length)
      break
    }

    case 'clientes': {
      const rows = await db.update(customers).set({ archivedAt })
        .where(and(eq(customers.id, id), isNull(customers.archivedAt))).returning({ id: customers.id })
      requireAffected(rows.length)
      break
    }

    case 'proveedores': {
      const rows = await db.update(suppliers).set({ archivedAt })
        .where(and(eq(suppliers.id, id), isNull(suppliers.archivedAt))).returning({ id: suppliers.id })
      requireAffected(rows.length)
      break
    }

    case 'precios-proveedor': {
      const rows = await db.update(supplierPrices).set({ archivedAt })
        .where(and(eq(supplierPrices.id, id), isNull(supplierPrices.archivedAt))).returning({ id: supplierPrices.id })
      requireAffected(rows.length)
      break
    }

    case 'precios-maceta': {
      const rows = await db.update(plantPotPrices).set({ archivedAt })
        .where(and(eq(plantPotPrices.id, id), isNull(plantPotPrices.archivedAt))).returning({ id: plantPotPrices.id })
      requireAffected(rows.length)
      break
    }

    case 'ubicaciones': {
      const rows = await db.update(locations).set({ archivedAt, updatedAt: archivedAt })
        .where(and(eq(locations.id, id), isNull(locations.archivedAt))).returning({ id: locations.id })
      requireAffected(rows.length)
      break
    }

    case 'zonas': {
      const zoneId = routeId!
      const rows = await db.update(zones).set({ archivedAt, updatedAt: archivedAt })
        .where(and(eq(zones.id, zoneId), isNull(zones.archivedAt))).returning({ id: zones.id })
      requireAffected(rows.length)
      break
    }

    case 'compras': {
      await db.transaction(async (tx) => {
        const [purchase] = await tx.select().from(purchases)
          .where(and(eq(purchases.id, id), isNull(purchases.archivedAt))).limit(1)
        if (!purchase) throw createError({ statusCode: 404, statusMessage: 'No se encontró una compra activa para archivar.' })
        const updated = await tx.update(products).set({
          stock: sql`${products.stock} - ${purchase.quantity}`,
          updatedAt: archivedAt
        }).where(sql`${products.id} = ${purchase.productId} and ${products.stock} >= ${purchase.quantity}`).returning({ id: products.id })
        if (updated.length === 0) {
          throw createError({
            statusCode: 409,
            statusMessage: 'No se puede archivar esta compra porque el stock actual ya no alcanza para revertirla.'
          })
        }
        await tx.update(purchases).set({ archivedAt }).where(eq(purchases.id, id))
      })
      break
    }

    case 'ventas': {
      await db.transaction(async (tx) => {
        const [sale] = await tx.select().from(sales).where(eq(sales.id, id)).limit(1)
        if (!sale) throw createError({ statusCode: 404, statusMessage: 'No se encontró la venta.' })
        if (sale.cae || sale.billingStatus === 'billed') {
          throw createError({ statusCode: 409, statusMessage: 'Un comprobante fiscal emitido no se puede cancelar desde el panel.' })
        }
        if (sale.status === 'Cancelada') {
          throw createError({ statusCode: 409, statusMessage: 'La venta ya está cancelada.' })
        }
        if (sale.inventoryAppliedAt !== null) {
          const items = await tx.select({ productId: saleItems.productId, quantity: saleItems.quantity })
            .from(saleItems).where(and(eq(saleItems.saleId, id), isNull(saleItems.archivedAt)))
          for (const item of items) {
            await tx.update(products).set({
              stock: sql`${products.stock} + ${item.quantity}`,
              updatedAt: archivedAt
            }).where(eq(products.id, item.productId))
          }
        }
        await tx.update(sales).set({
          status: 'Cancelada',
          inventoryAppliedAt: null,
          updatedAt: archivedAt
        }).where(eq(sales.id, id))
      })
      break
    }

    case 'facturas':
      throw createError({ statusCode: 409, statusMessage: 'El comprobante se conserva junto a la venta. Para anularlo, usa la acción de cancelar venta si todavía no fue emitido fiscalmente.' })

    default:
      throw createError({ statusCode: 405, statusMessage: 'Esta sección se deriva de otros registros y no admite archivo directo.' })
  }

  return { success: true, data: { id: routeId, archived: true } }
})
