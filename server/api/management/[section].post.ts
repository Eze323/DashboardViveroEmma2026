import { eq, sql } from 'drizzle-orm'
import { getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { customers, locations, plantPotPrices, products, purchases, saleItems, sales, supplierPrices, suppliers, users, zones } from '../../../src/db/schema'
import { useDrizzle } from '../../utils/drizzle'
import { isUniqueConstraintError, managementSections } from '../../utils/management'
import { priceSaleLines } from '../../utils/sale-pricing'

const positiveId = z.coerce.number().int().positive().safe()
const money = z.coerce.number().finite().min(0).max(99999999.99)
const optionalText = z.string().trim().max(500).optional().nullable()
const productInput = z.object({
  nombre: z.string().trim().min(1).max(255),
  categoria: z.string().trim().min(1).max(50),
  descripcion: optionalText,
  precioCompra: money,
  precio: money,
  stock: z.coerce.number().int().min(0).max(100000000),
  potSize: z.string().trim().max(50).optional().nullable(),
  imageUrl: z.string().trim().max(255).optional().nullable(),
  estado: z.enum(['Publicado', 'Borrador']).default('Publicado')
})
const customerInput = z.object({
  nombre: z.string().trim().min(1).max(255),
  email: z.union([z.string().trim().email().max(255), z.literal('')]).optional(),
  telefono: z.string().trim().max(20).optional(),
  localidad: z.string().trim().max(500).optional(),
  taxId: z.string().trim().max(20).optional(),
  ivaCondition: z.string().trim().max(50).optional(),
  fiscalAddress: z.string().trim().max(10000).optional()
})
const supplierInput = z.object({ nombre: z.string().trim().min(1).max(255) })
const purchaseInput = z.object({
  productoId: positiveId,
  proveedorId: positiveId,
  cantidad: z.coerce.number().int().positive().max(100000000),
  precio: money,
  fecha: z.string().datetime({ offset: true })
})
const supplierPriceInput = z.object({
  productoId: positiveId,
  proveedorId: positiveId,
  precio: money,
  desde: z.string().datetime({ offset: true }).optional().or(z.literal('')),
  hasta: z.string().datetime({ offset: true }).optional().or(z.literal(''))
})
const plantPriceInput = z.object({
  productoId: positiveId,
  medida: z.string().trim().min(1).max(50),
  precio: money
})
const locationInput = z.object({
  nombre: z.string().trim().min(1).max(255),
  area: z.string().trim().max(255).optional(),
  monitoreada: z.coerce.boolean().default(true),
  x: z.coerce.number().int().min(-100000).max(100000).default(0),
  y: z.coerce.number().int().min(-100000).max(100000).default(0),
  estado: z.string().trim().min(1).max(255).default('active')
})
const zoneInput = z.object({
  nombre: z.string().trim().min(1).max(255),
  x: z.coerce.number().int().min(-100000).max(100000),
  y: z.coerce.number().int().min(-100000).max(100000),
  ancho: z.coerce.number().int().positive().max(100000),
  alto: z.coerce.number().int().positive().max(100000),
  color: z.string().trim().min(1).max(255)
})
const saleInput = z.object({
  clienteId: positiveId.optional().nullable(),
  cliente: z.string().trim().min(1).max(255).default('Consumidor Final'),
  vendedor: z.string().trim().min(1).max(255).default('Panel de gestión'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  estado: z.enum(['Completada', 'Pendiente']).default('Completada'),
  items: z.array(z.object({
    productoId: positiveId,
    cantidad: z.coerce.number().int().positive().max(1000000),
    medida: z.string().trim().max(50).optional()
  })).min(1).max(100)
})

function requireRow<T>(row: T | undefined, action: string): T {
  if (!row) throw new Error(`La base no devolvió el registro al ${action}.`)
  return row
}

function throwWriteError(error: unknown): never {
  if (isUniqueConstraintError(error)) {
    throw createError({ statusCode: 409, statusMessage: 'Ya existe un registro con esos datos únicos.' })
  }
  if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
  console.error('Error al crear un registro de gestión:', error)
  throw createError({ statusCode: 500, statusMessage: 'No se pudo guardar el registro.' })
}

export default defineEventHandler(async (event) => {
  const section = getRouterParam(event, 'section') ?? ''
  if (!managementSections.includes(section as typeof managementSections[number])) {
    throw createError({ statusCode: 404, statusMessage: 'La sección solicitada no existe.' })
  }
  const body: unknown = await readBody(event)
  const db = useDrizzle()

  try {
    switch (section) {
      case 'productos': {
        const input = productInput.parse(body)
        const product = await db.transaction(async (tx) => {
          const inserted = requireRow((await tx.insert(products).values({
            name: input.nombre,
            category: input.categoria,
            description: input.descripcion || null,
            purchasePrice: input.precioCompra.toFixed(2),
            salePrice: input.precio.toFixed(2),
            stock: input.stock,
            potSize: input.potSize || null,
            imageUrl: input.imageUrl || null,
            published: input.estado === 'Publicado',
            sku: null
          }).returning({ id: products.id }))[0], 'crear el producto')
          const sku = `VE-${String(inserted.id).padStart(6, '0')}`
          return requireRow((await tx.update(products).set({ sku }).where(eq(products.id, inserted.id)).returning())[0], 'asignar el SKU')
        })
        return { success: true, data: { id: String(product.id), sku: product.sku } }
      }

      case 'clientes': {
        const input = customerInput.parse(body)
        const row = requireRow((await db.insert(customers).values({
          name: input.nombre,
          email: input.email || null,
          phone: input.telefono || null,
          address: input.localidad || null,
          taxId: input.taxId || null,
          ivaCondition: input.ivaCondition || null,
          fiscalAddress: input.fiscalAddress || null
        }).returning({ id: customers.id }))[0], 'crear el cliente')
        return { success: true, data: { id: String(row.id) } }
      }

      case 'proveedores': {
        const input = supplierInput.parse(body)
        const row = requireRow((await db.insert(suppliers).values({ name: input.nombre }).returning({ id: suppliers.id }))[0], 'crear el proveedor')
        return { success: true, data: { id: String(row.id) } }
      }

      case 'ventas': {
        const input = saleInput.parse(body)
        const totalsByProduct = new Map<number, number>()
        for (const item of input.items) {
          totalsByProduct.set(item.productoId, (totalsByProduct.get(item.productoId) ?? 0) + item.cantidad)
        }

        const sale = await db.transaction(async (tx) => {
          const customerId = input.clienteId ?? null
          let customerName = input.cliente
          if (customerId !== null) {
            const [customer] = await tx.select({ id: customers.id, name: customers.name }).from(customers)
              .where(sql`${customers.id} = ${customerId} and ${customers.archivedAt} is null`).limit(1)
            if (!customer) throw createError({ statusCode: 400, statusMessage: 'El cliente no existe o está archivado.' })
            customerName = customer.name
          }

          const [user] = await tx.select({ id: users.id }).from(users).orderBy(users.id).limit(1)
          if (!user) throw createError({ statusCode: 503, statusMessage: 'No hay un usuario de sistema para registrar la venta.' })

          const now = new Date()
          const appliesInventory = input.estado === 'Completada'
          const pricedItems = await priceSaleLines(tx, input.items.map(item => ({
            productId: item.productoId,
            quantity: item.cantidad,
            potSize: item.medida
          })))
          let total = pricedItems.reduce((sum, item) => sum + item.quantity * Number(item.unitPrice), 0)
          total = Math.round((total + Number.EPSILON) * 100) / 100
          if (!Number.isFinite(total) || total > 9999999999.99) {
            throw createError({ statusCode: 400, statusMessage: 'El total de la venta excede el máximo permitido.' })
          }

          if (appliesInventory) {
            for (const [productId, quantity] of totalsByProduct) {
              const updated = await tx.update(products).set({
                stock: sql`${products.stock} - ${quantity}`,
                updatedAt: now
              }).where(sql`${products.id} = ${productId} and ${products.archivedAt} is null and ${products.stock} >= ${quantity}`).returning({ id: products.id })
              if (updated.length === 0) {
                const [product] = await tx.select({ name: products.name, stock: products.stock }).from(products).where(eq(products.id, productId)).limit(1)
                if (!product) throw createError({ statusCode: 400, statusMessage: 'Uno de los productos no existe o está archivado.' })
                throw createError({ statusCode: 409, statusMessage: `Stock insuficiente para "${product.name}". Disponible: ${product.stock}.` })
              }
            }
          }

          const created = requireRow((await tx.insert(sales).values({
            userId: user.id,
            customerId,
            customer: customerName,
            seller: input.vendedor,
            date: input.fecha,
            status: input.estado,
            totalPrice: total.toFixed(2),
            invoiceType: 99,
            pointOfSale: 1,
            customerIvaCondition: 'Consumidor Final',
            docType: 99,
            netAmount: total.toFixed(2),
            vatAmount: '0.00',
            billingStatus: 'unbilled',
            inventoryAppliedAt: appliesInventory ? now : null
          }).returning({ id: sales.id }))[0], 'crear la venta')

          for (const item of pricedItems) {
            await tx.insert(saleItems).values({
              saleId: created.id,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              potSize: item.potSize
            })
          }
          return { ...created, total }
        })
        return { success: true, data: { id: String(sale.id), total: sale.total } }
      }

      case 'compras': {
        const input = purchaseInput.parse(body)
        const purchase = await db.transaction(async (tx) => {
          const [product] = await tx.select({ id: products.id }).from(products)
            .where(sql`${products.id} = ${input.productoId} and ${products.archivedAt} is null`).limit(1)
          const [supplier] = await tx.select({ id: suppliers.id }).from(suppliers)
            .where(sql`${suppliers.id} = ${input.proveedorId} and ${suppliers.archivedAt} is null`).limit(1)
          if (!product || !supplier) throw createError({ statusCode: 400, statusMessage: 'Selecciona un producto y proveedor activos.' })

          const created = requireRow((await tx.insert(purchases).values({
            productId: input.productoId,
            supplierId: input.proveedorId,
            quantity: input.cantidad,
            purchasePrice: input.precio.toFixed(2),
            purchaseDate: new Date(input.fecha)
          }).returning({ id: purchases.id }))[0], 'crear la compra')
          await tx.update(products).set({
            stock: sql`${products.stock} + ${input.cantidad}`,
            updatedAt: new Date()
          }).where(eq(products.id, input.productoId))
          return created
        })
        return { success: true, data: { id: String(purchase.id) } }
      }

      case 'precios-proveedor': {
        const input = supplierPriceInput.parse(body)
        const row = requireRow((await db.insert(supplierPrices).values({
          productId: input.productoId,
          supplierId: input.proveedorId,
          purchasePrice: input.precio.toFixed(2),
          validFrom: input.desde ? new Date(input.desde) : new Date(),
          validTo: input.hasta ? new Date(input.hasta) : null
        }).returning({ id: supplierPrices.id }))[0], 'crear el precio de proveedor')
        return { success: true, data: { id: String(row.id) } }
      }

      case 'precios-maceta': {
        const input = plantPriceInput.parse(body)
        const row = requireRow((await db.insert(plantPotPrices).values({
          productId: input.productoId,
          potSize: input.medida,
          price: input.precio.toFixed(2)
        }).returning({ id: plantPotPrices.id }))[0], 'crear el precio por tamaño de maceta')
        return { success: true, data: { id: String(row.id) } }
      }

      case 'ubicaciones': {
        const input = locationInput.parse(body)
        const row = requireRow((await db.insert(locations).values({
          name: input.nombre,
          area: input.area || null,
          isMonitored: input.monitoreada,
          x: input.x,
          y: input.y,
          status: input.estado
        }).returning({ id: locations.id }))[0], 'crear la ubicación')
        return { success: true, data: { id: String(row.id) } }
      }

      case 'zonas': {
        const input = zoneInput.parse(body)
        const id = crypto.randomUUID()
        await db.insert(zones).values({
          id,
          name: input.nombre,
          x: input.x,
          y: input.y,
          width: input.ancho,
          height: input.alto,
          color: input.color
        })
        return { success: true, data: { id } }
      }

      default:
        throw createError({ statusCode: 405, statusMessage: 'Esta sección se deriva de otros registros y no admite altas directas.' })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw createError({ statusCode: 400, statusMessage: error.issues[0]?.message ?? 'Los datos enviados no son válidos.' })
    }
    return throwWriteError(error)
  }
})
