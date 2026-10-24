import { and, eq, isNull, sql } from 'drizzle-orm'
import { getRouterParam, readBody } from 'h3'
import { z } from 'zod'
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
import { isUniqueConstraintError, managementSections, parsePositiveId } from '../../../utils/management'
import { priceSaleLines } from '../../../utils/sale-pricing'
import { notDeleted } from '../../../utils/soft-delete'

const idField = z.coerce.number().int().positive().safe()
const priceField = z.coerce.number().finite().min(0).max(99999999.99)
const productInput = z.object({
  nombre: z.string().trim().min(1).max(255),
  categoria: z.string().trim().min(1).max(50),
  descripcion: z.string().trim().max(500).optional(),
  precioCompra: priceField,
  precio: priceField,
  stock: z.coerce.number().int().min(0).max(100000000),
  potSize: z.string().trim().max(50).optional(),
  imageUrl: z.string().trim().max(255).optional(),
  estado: z.enum(['Publicado', 'Borrador'])
}).partial()
const customerInput = z.object({
  nombre: z.string().trim().min(1).max(255),
  email: z.union([z.string().trim().email().max(255), z.literal('')]),
  telefono: z.string().trim().max(20),
  localidad: z.string().trim().max(500),
  taxId: z.string().trim().max(20),
  ivaCondition: z.string().trim().max(50),
  fiscalAddress: z.string().trim().max(10000)
}).partial()
const saleInput = z.object({
  clienteId: idField.nullable(),
  cliente: z.string().trim().min(1).max(255),
  vendedor: z.string().trim().min(1).max(255),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  estado: z.enum(['Completada', 'Pendiente']),
  items: z.array(z.object({
    productoId: idField,
    cantidad: z.coerce.number().int().positive().max(1000000),
    medida: z.string().trim().max(50).optional()
  })).min(1).max(100)
}).partial()
const supplierInput = z.object({ nombre: z.string().trim().min(1).max(255) }).partial()
const purchaseInput = z.object({
  productoId: idField,
  proveedorId: idField,
  cantidad: z.coerce.number().int().positive().max(100000000),
  precio: priceField,
  fecha: z.string().datetime({ offset: true })
}).partial()
const supplierPriceInput = z.object({
  productoId: idField,
  proveedorId: idField,
  precio: priceField,
  desde: z.string().datetime({ offset: true }).or(z.literal('')),
  hasta: z.string().datetime({ offset: true }).or(z.literal(''))
}).partial()
const plantPriceInput = z.object({
  productoId: idField,
  medida: z.string().trim().min(1).max(50),
  precio: priceField
}).partial()
const locationInput = z.object({
  nombre: z.string().trim().min(1).max(255),
  area: z.string().trim().max(255),
  monitoreada: z.coerce.boolean(),
  x: z.coerce.number().int().min(-100000).max(100000),
  y: z.coerce.number().int().min(-100000).max(100000),
  estado: z.string().trim().min(1).max(255)
}).partial()
const zoneInput = z.object({
  nombre: z.string().trim().min(1).max(255),
  x: z.coerce.number().int().min(-100000).max(100000),
  y: z.coerce.number().int().min(-100000).max(100000),
  ancho: z.coerce.number().int().positive().max(100000),
  alto: z.coerce.number().int().positive().max(100000),
  color: z.string().trim().min(1).max(255)
}).partial()

function requireRow<T>(row: T | undefined, action: string): T {
  if (!row) throw createError({ statusCode: 404, statusMessage: `No se encontró el registro para ${action}.` })
  return row
}

function throwWriteError(error: unknown): never {
  if (isUniqueConstraintError(error)) {
    throw createError({ statusCode: 409, statusMessage: 'Ya existe un registro con esos datos únicos.' })
  }
  if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
  console.error('Error al actualizar un registro de gestión:', error)
  throw createError({ statusCode: 500, statusMessage: 'No se pudo actualizar el registro.' })
}

async function applyInventoryDelta(
  tx: Parameters<Parameters<ReturnType<typeof useDrizzle>['transaction']>[0]>[0],
  deltas: Map<number, number>
) {
  for (const [productId, delta] of deltas) {
    if (delta === 0) continue
    const changed = delta > 0
      ? await tx.update(products).set({
          stock: sql`${products.stock} + ${delta}`,
          updatedAt: new Date()
        }).where(eq(products.id, productId)).returning({ id: products.id })
      : await tx.update(products).set({
          stock: sql`${products.stock} + ${delta}`,
          updatedAt: new Date()
        }).where(sql`${products.id} = ${productId} and ${products.stock} >= ${-delta}`).returning({ id: products.id })
    if (changed.length === 0) {
      throw createError({ statusCode: 409, statusMessage: 'El ajuste dejaría el inventario por debajo de cero o el producto ya no existe.' })
    }
  }
}

export default defineEventHandler(async (event) => {
  const section = getRouterParam(event, 'section') ?? ''
  if (!managementSections.includes(section as typeof managementSections[number])) {
    throw createError({ statusCode: 404, statusMessage: 'La sección solicitada no existe.' })
  }
  const routeId = getRouterParam(event, 'id')
  const id = section === 'zonas' ? 0 : parsePositiveId(routeId)
  const body: unknown = await readBody(event)
  const db = useDrizzle()

  try {
    switch (section) {
      case 'productos': {
        const input = productInput.parse(body)
        const updated = await db.update(products).set({
          ...(input.nombre !== undefined ? { name: input.nombre } : {}),
          ...(input.categoria !== undefined ? { category: input.categoria } : {}),
          ...(input.descripcion !== undefined ? { description: input.descripcion || null } : {}),
          ...(input.precioCompra !== undefined ? { purchasePrice: input.precioCompra.toFixed(2) } : {}),
          ...(input.precio !== undefined ? { salePrice: input.precio.toFixed(2) } : {}),
          ...(input.stock !== undefined ? { stock: input.stock } : {}),
          ...(input.potSize !== undefined ? { potSize: input.potSize || null } : {}),
          ...(input.estado !== undefined ? { published: input.estado === 'Publicado' } : {}),
          updatedAt: new Date()
        }).where(and(eq(products.id, id), notDeleted(products))).returning({ id: products.id })
        requireRow(updated[0], 'actualizar el producto')
        return { success: true, data: { id: String(id) } }
      }

      case 'clientes': {
        const input = customerInput.parse(body)
        const updated = await db.update(customers).set({
          ...(input.nombre !== undefined ? { name: input.nombre } : {}),
          ...(input.email !== undefined ? { email: input.email || null } : {}),
          ...(input.telefono !== undefined ? { phone: input.telefono || null } : {}),
          ...(input.localidad !== undefined ? { address: input.localidad || null } : {}),
          ...(input.taxId !== undefined ? { taxId: input.taxId || null } : {}),
          ...(input.ivaCondition !== undefined ? { ivaCondition: input.ivaCondition || null } : {}),
          ...(input.fiscalAddress !== undefined ? { fiscalAddress: input.fiscalAddress || null } : {})
        }).where(and(eq(customers.id, id), notDeleted(customers))).returning({ id: customers.id })
        requireRow(updated[0], 'actualizar el cliente')
        return { success: true, data: { id: String(id) } }
      }

      case 'proveedores': {
        const input = supplierInput.parse(body)
        const updated = await db.update(suppliers).set({ name: input.nombre! })
          .where(and(eq(suppliers.id, id), notDeleted(suppliers))).returning({ id: suppliers.id })
        requireRow(updated[0], 'actualizar el proveedor')
        return { success: true, data: { id: String(id) } }
      }

      case 'compras': {
        const input = purchaseInput.parse(body)
        await db.transaction(async (tx) => {
          const [old] = await tx.select().from(purchases).where(and(eq(purchases.id, id), notDeleted(purchases))).limit(1)
          const oldPurchase = requireRow(old, 'encontrar la compra')
          const nextProductId = input.productoId ?? oldPurchase.productId
          const nextSupplierId = input.proveedorId ?? oldPurchase.supplierId
          const nextQuantity = input.cantidad ?? oldPurchase.quantity
          const nextPrice = input.precio?.toFixed(2) ?? oldPurchase.purchasePrice
          const nextDate = input.fecha ? new Date(input.fecha) : oldPurchase.purchaseDate
          const [product] = await tx.select({ id: products.id }).from(products).where(and(eq(products.id, nextProductId), notDeleted(products))).limit(1)
          const [supplier] = await tx.select({ id: suppliers.id }).from(suppliers).where(and(eq(suppliers.id, nextSupplierId), notDeleted(suppliers))).limit(1)
          if (!product || !supplier) throw createError({ statusCode: 400, statusMessage: 'Selecciona un producto y proveedor activos.' })
          const deltas = new Map<number, number>()
          deltas.set(oldPurchase.productId, (deltas.get(oldPurchase.productId) ?? 0) - oldPurchase.quantity)
          deltas.set(nextProductId, (deltas.get(nextProductId) ?? 0) + nextQuantity)
          await applyInventoryDelta(tx, deltas)
          await tx.update(purchases).set({
            productId: nextProductId,
            supplierId: nextSupplierId,
            quantity: nextQuantity,
            purchasePrice: nextPrice,
            purchaseDate: nextDate
          }).where(eq(purchases.id, id))
        })
        return { success: true, data: { id: String(id) } }
      }

      case 'precios-proveedor': {
        const input = supplierPriceInput.parse(body)
        const updated = await db.update(supplierPrices).set({
          ...(input.productoId !== undefined ? { productId: input.productoId } : {}),
          ...(input.proveedorId !== undefined ? { supplierId: input.proveedorId } : {}),
          ...(input.precio !== undefined ? { purchasePrice: input.precio.toFixed(2) } : {}),
          ...(input.desde !== undefined ? { validFrom: input.desde ? new Date(input.desde) : null } : {}),
          ...(input.hasta !== undefined ? { validTo: input.hasta ? new Date(input.hasta) : null } : {})
        }).where(and(eq(supplierPrices.id, id), notDeleted(supplierPrices))).returning({ id: supplierPrices.id })
        requireRow(updated[0], 'actualizar el precio de proveedor')
        return { success: true, data: { id: String(id) } }
      }

      case 'precios-maceta': {
        const input = plantPriceInput.parse(body)
        const updated = await db.update(plantPotPrices).set({
          ...(input.productoId !== undefined ? { productId: input.productoId } : {}),
          ...(input.medida !== undefined ? { potSize: input.medida } : {}),
          ...(input.precio !== undefined ? { price: input.precio.toFixed(2) } : {}),
        }).where(and(eq(plantPotPrices.id, id), notDeleted(plantPotPrices))).returning({ id: plantPotPrices.id })
        requireRow(updated[0], 'actualizar el precio por tamaño')
        return { success: true, data: { id: String(id) } }
      }

      case 'ubicaciones': {
        const input = locationInput.parse(body)
        const updated = await db.update(locations).set({
          ...(input.nombre !== undefined ? { name: input.nombre } : {}),
          ...(input.area !== undefined ? { area: input.area || null } : {}),
          ...(input.monitoreada !== undefined ? { isMonitored: input.monitoreada } : {}),
          ...(input.x !== undefined ? { x: input.x } : {}),
          ...(input.y !== undefined ? { y: input.y } : {}),
          ...(input.estado !== undefined ? { status: input.estado } : {}),
          updatedAt: new Date()
        }).where(and(eq(locations.id, id), notDeleted(locations))).returning({ id: locations.id })
        requireRow(updated[0], 'actualizar la ubicación')
        return { success: true, data: { id: String(id) } }
      }

      case 'zonas': {
        const input = zoneInput.parse(body)
        const zoneId = routeId!
        const updated = await db.update(zones).set({
          ...(input.nombre !== undefined ? { name: input.nombre } : {}),
          ...(input.x !== undefined ? { x: input.x } : {}),
          ...(input.y !== undefined ? { y: input.y } : {}),
          ...(input.ancho !== undefined ? { width: input.ancho } : {}),
          ...(input.alto !== undefined ? { height: input.alto } : {}),
          ...(input.color !== undefined ? { color: input.color } : {}),
          updatedAt: new Date()
        }).where(and(eq(zones.id, zoneId), notDeleted(zones))).returning({ id: zones.id })
        requireRow(updated[0], 'actualizar la zona')
        return { success: true, data: { id: zoneId } }
      }

      case 'ventas': {
        const input = saleInput.parse(body)
        await db.transaction(async (tx) => {
          const [old] = await tx.select().from(sales).where(and(eq(sales.id, id), notDeleted(sales))).limit(1)
          const oldSale = requireRow(old, 'encontrar la venta')
          if (oldSale.status === 'Cancelada' || oldSale.status === 'Anulada') {
            throw createError({ statusCode: 409, statusMessage: 'Una venta cancelada o anulada no se puede editar.' })
          }
          if (oldSale.cae || oldSale.billingStatus === 'billed') {
            throw createError({ statusCode: 409, statusMessage: 'Un comprobante fiscal emitido es inmutable.' })
          }
          if (oldSale.status === 'Completada' && oldSale.inventoryAppliedAt === null && input.items) {
            throw createError({
              statusCode: 409,
              statusMessage: 'No se pueden cambiar las líneas de una venta histórica cuyo movimiento de stock no está registrado.'
            })
          }

          const currentItems = await tx.select().from(saleItems).where(and(eq(saleItems.saleId, id), notDeleted(saleItems)))
          const nextStatus = input.estado ?? oldSale.status
          const nextItems = input.items
            ? await priceSaleLines(tx, input.items.map(item => ({
                productId: item.productoId,
                quantity: item.cantidad,
                potSize: item.medida
              })))
            : currentItems.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                potSize: item.potSize,
                unitPrice: item.unitPrice
              }))
          const nextCustomerId = input.clienteId === undefined ? oldSale.customerId : input.clienteId
          let nextCustomer = input.cliente ?? oldSale.customer
          if (nextCustomerId !== null) {
            const [customer] = await tx.select({ id: customers.id, name: customers.name }).from(customers)
              .where(and(eq(customers.id, nextCustomerId), notDeleted(customers))).limit(1)
            if (!customer) throw createError({ statusCode: 400, statusMessage: 'El cliente no existe o está eliminado.' })
            nextCustomer = customer.name
          }

          const totalsByItems = (items: typeof nextItems) => {
            const totals = new Map<number, number>()
            for (const item of items) totals.set(item.productId, (totals.get(item.productId) ?? 0) + item.quantity)
            return totals
          }
          const deltas = new Map<number, number>()
          const oldItemsByProduct = totalsByItems(currentItems)
          const nextItemsByProduct = totalsByItems(nextItems)
          const oldApplied = oldSale.inventoryAppliedAt !== null
          const newApplied = nextStatus === 'Completada' && (oldApplied || oldSale.status !== 'Completada')
          for (const productId of new Set([...oldItemsByProduct.keys(), ...nextItemsByProduct.keys()])) {
            const oldQuantity = oldItemsByProduct.get(productId) ?? 0
            const nextQuantity = nextItemsByProduct.get(productId) ?? 0
            const delta = (oldApplied ? oldQuantity : 0) - (newApplied ? nextQuantity : 0)
            if (delta) deltas.set(productId, delta)
          }
          await applyInventoryDelta(tx, deltas)

          if (input.items) {
            const now = new Date()
            await tx.update(saleItems).set({ deletedAt: now, archivedAt: now })
              .where(and(eq(saleItems.saleId, id), notDeleted(saleItems)))
            for (const item of nextItems) {
              await tx.insert(saleItems).values({
                saleId: id,
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                potSize: item.potSize
              })
            }
          }

          const total = nextItems.reduce((sum, item) => sum + item.quantity * Number(item.unitPrice), 0)
          await tx.update(sales).set({
            customerId: nextCustomerId,
            customer: nextCustomer,
            seller: input.vendedor ?? oldSale.seller,
            date: input.fecha ?? oldSale.date,
            status: nextStatus,
            totalPrice: total.toFixed(2),
            inventoryAppliedAt: newApplied ? oldSale.inventoryAppliedAt ?? new Date() : null,
            updatedAt: new Date()
          }).where(eq(sales.id, id))
        })
        return { success: true, data: { id: String(id) } }
      }

      case 'facturas':
        throw createError({ statusCode: 409, statusMessage: 'Los comprobantes se actualizan desde la venta asociada; los emitidos son inmutables.' })

      default:
        throw createError({ statusCode: 405, statusMessage: 'Esta sección se deriva de otros registros y no admite edición directa.' })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw createError({ statusCode: 400, statusMessage: error.issues[0]?.message ?? 'Los datos enviados no son válidos.' })
    }
    return throwWriteError(error)
  }
})
