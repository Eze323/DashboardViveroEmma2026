import { and, asc, count, countDistinct, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { getRouterParam } from 'h3'
import {
  customers,
  locations,
  plantPotPrices,
  products,
  purchases,
  sales,
  saleItems,
  supplierPrices,
  suppliers,
  users,
  zones
} from '../../../src/db/schema'
import { useDrizzle } from '../../utils/drizzle'
import { requireRole } from '../../utils/auth'
import { managementSections, paginationMeta, parseManagementQuery } from '../../utils/management'
import { notDeleted, softDeleteFilter } from '../../utils/soft-delete'

export default defineEventHandler(async (event) => {
  const section = getRouterParam(event, 'section') ?? ''
  if (!managementSections.includes(section as typeof managementSections[number])) {
    throw createError({ statusCode: 404, statusMessage: 'La sección solicitada no existe.' })
  }
  if (section === 'accesos') requireRole(event, 'admin')

  const query = parseManagementQuery(event)
  const db = useDrizzle()
  const pattern = `%${query.search.replace(/[\\%_]/g, '\\$&')}%`

  switch (section) {
    case 'productos': {
      const where = and(
        softDeleteFilter(products, query.archived),
        query.search ? or(ilike(products.name, pattern), ilike(products.category, pattern), ilike(products.sku, pattern)) : undefined,
        query.status ? eq(products.published, query.status === 'Publicado') : undefined
      )
      const [rows, totals] = await Promise.all([
        db.select().from(products).where(where).orderBy(asc(products.name), asc(products.id)).limit(query.limit).offset(query.offset),
        db.select({ total: count() }).from(products).where(where)
      ])
      return {
        section,
        source: 'database' as const,
        data: rows.map(row => ({
          id: String(row.id),
          nombre: row.name,
          categoria: row.category,
          sku: row.sku ?? '',
          descripcion: row.description ?? '',
          precioCompra: Number(row.purchasePrice),
          stock: row.stock,
          potSize: row.potSize ?? '',
          imageUrl: row.imageUrl ?? '',
          precio: Number(row.salePrice),
          estado: row.published ? (row.stock > 0 ? 'Publicado' : 'Sin stock') : 'Borrador',
          archivado: row.deletedAt !== null || row.archivedAt !== null,
          deletedAt: row.deletedAt
        })),
        meta: paginationMeta(query.page, query.limit, totals[0]?.total ?? 0)
      }
    }

    case 'clientes': {
      const where = and(
        softDeleteFilter(customers, query.archived),
        query.search ? or(ilike(customers.name, pattern), ilike(customers.email, pattern), ilike(customers.phone, pattern)) : undefined
      )
      const [rows, totals] = await Promise.all([
        db.select({
          id: customers.id,
          name: customers.name,
          email: customers.email,
          phone: customers.phone,
          address: customers.address,
          taxId: customers.taxId,
          ivaCondition: customers.ivaCondition,
          fiscalAddress: customers.fiscalAddress,
          purchases: sql<number>`(select count(*)::int from ${sales} where ${sales.customerId} = ${customers.id} and ${sales.deletedAt} is null)`,
          archivedAt: customers.archivedAt,
          deletedAt: customers.deletedAt
        }).from(customers).where(where).orderBy(asc(customers.name), asc(customers.id)).limit(query.limit).offset(query.offset),
        db.select({ total: count() }).from(customers).where(where)
      ])
      return {
        section,
        source: 'database' as const,
        data: rows.map(row => ({
          id: String(row.id),
          nombre: row.name,
          email: row.email ?? '',
          telefono: row.phone ?? '',
          localidad: row.address ?? '',
          taxId: row.taxId ?? '',
          ivaCondition: row.ivaCondition ?? '',
          fiscalAddress: row.fiscalAddress ?? '',
          compras: row.purchases,
          archivado: row.deletedAt !== null || row.archivedAt !== null,
          deletedAt: row.deletedAt
        })),
        meta: paginationMeta(query.page, query.limit, totals[0]?.total ?? 0)
      }
    }

    case 'ventas':
    case 'facturas': {
      const where = and(
        softDeleteFilter(sales, query.archived),
        query.search ? or(ilike(sales.customer, pattern), ilike(sales.seller, pattern), ilike(sales.status, pattern), sql`${sales.id}::text ilike ${pattern}`) : undefined,
        query.status ? eq(sales.status, query.status) : undefined
      )
      const [rows, totals] = await Promise.all([
        db.select({
          id: sales.id,
          date: sales.date,
          time: sales.time,
          customer: sales.customer,
          customerId: sales.customerId,
          seller: sales.seller,
          total: sales.totalPrice,
          status: sales.status,
          invoiceType: sales.invoiceType,
          pointOfSale: sales.pointOfSale,
          invoiceNumber: sales.invoiceNumber,
          billingStatus: sales.billingStatus,
          cae: sales.cae,
          caeExpiration: sales.caeExpiration,
          inventoryAppliedAt: sales.inventoryAppliedAt,
          deletedAt: sales.deletedAt,
          itemCount: sql<number>`(select count(*)::int from ${saleItems} where ${saleItems.saleId} = ${sales.id} and ${saleItems.deletedAt} is null)`
        }).from(sales).where(where).orderBy(desc(sales.date), desc(sales.id)).limit(query.limit).offset(query.offset),
        db.select({ total: count() }).from(sales).where(where)
      ])
      const invoiceTypes: Record<number, string> = { 1: 'Factura A', 6: 'Factura B', 11: 'Factura C', 99: 'Ticket' }
      return {
        section,
        source: 'database' as const,
        data: rows.map(row => ({
          id: String(row.id),
          fecha: row.date,
          hora: row.time ?? '',
          cliente: row.customer,
          clienteId: row.customerId === null ? '' : String(row.customerId),
          vendedor: row.seller,
          total: Number(row.total),
          estado: row.status,
          tipo: invoiceTypes[row.invoiceType ?? 99] ?? 'Ticket',
          numero: row.invoiceNumber === null ? '' : String(row.invoiceNumber),
          estadoFactura: row.billingStatus ?? 'unbilled',
          cae: row.cae ?? '',
          caeVencimiento: row.caeExpiration ?? '',
          items: row.itemCount,
          editable: !row.cae
            && row.billingStatus !== 'billed'
            && (row.inventoryAppliedAt !== null || row.status !== 'Completada'),
          inventoryManaged: row.inventoryAppliedAt !== null,
          archivado: row.deletedAt !== null,
          deletedAt: row.deletedAt
        })),
        meta: paginationMeta(query.page, query.limit, totals[0]?.total ?? 0)
      }
    }

    case 'categorias': {
      const where = and(
        notDeleted(products),
        query.search ? ilike(products.category, pattern) : undefined
      )
      const [rows, totals] = await Promise.all([
        db.select({
          nombre: products.category,
          productos: count()
        }).from(products).where(where).groupBy(products.category).orderBy(asc(products.category)).limit(query.limit).offset(query.offset),
        db.select({ total: countDistinct(products.category) }).from(products).where(where)
      ])
      return {
        section,
        source: 'database' as const,
        data: rows.map(row => ({ id: row.nombre, nombre: row.nombre, productos: row.productos, estado: 'Activa' })),
        meta: paginationMeta(query.page, query.limit, totals[0]?.total ?? 0)
      }
    }

    case 'vendedores': {
      const where = and(
        notDeleted(sales),
        query.search ? ilike(sales.seller, pattern) : undefined
      )
      const [rows, totals] = await Promise.all([
        db.select({
          nombre: sales.seller,
          ventas: count()
        }).from(sales).where(where).groupBy(sales.seller).orderBy(asc(sales.seller)).limit(query.limit).offset(query.offset),
        db.select({ total: countDistinct(sales.seller) }).from(sales).where(where)
      ])
      return {
        section,
        source: 'database' as const,
        data: rows.map(row => ({ id: row.nombre, nombre: row.nombre, ventas: row.ventas })),
        meta: paginationMeta(query.page, query.limit, totals[0]?.total ?? 0)
      }
    }

    case 'accesos': {
      const where = and(
        softDeleteFilter(users, query.archived),
        query.search
          ? or(ilike(users.name, pattern), ilike(users.email, pattern), ilike(users.role, pattern))
          : undefined
      )
      const [rows, totals] = await Promise.all([
        db.select({
          id: users.id,
          nombre: users.name,
          email: users.email,
          rol: users.role,
          deletedAt: users.deletedAt
        }).from(users).where(where).orderBy(asc(users.name), asc(users.id)).limit(query.limit).offset(query.offset),
        db.select({ total: count() }).from(users).where(where)
      ])
      return {
        section,
        source: 'database' as const,
        data: rows.map(user => ({
          id: String(user.id),
          nombre: user.nombre,
          email: user.email,
          rol: user.rol ?? 'user',
          archivado: user.deletedAt !== null,
          deletedAt: user.deletedAt
        })),
        meta: paginationMeta(query.page, query.limit, totals[0]?.total ?? 0)
      }
    }

    case 'proveedores': {
      const where = and(
        softDeleteFilter(suppliers, query.archived),
        query.search ? ilike(suppliers.name, pattern) : undefined
      )
      const [rows, totals] = await Promise.all([
        db.select().from(suppliers).where(where).orderBy(asc(suppliers.name), asc(suppliers.id)).limit(query.limit).offset(query.offset),
        db.select({ total: count() }).from(suppliers).where(where)
      ])
      return {
        section,
        source: 'database' as const,
        data: rows.map(row => ({
          id: String(row.id),
          nombre: row.name,
          archivado: row.deletedAt !== null || row.archivedAt !== null,
          deletedAt: row.deletedAt
        })),
        meta: paginationMeta(query.page, query.limit, totals[0]?.total ?? 0)
      }
    }

    case 'compras': {
      const where = and(
        softDeleteFilter(purchases, query.archived),
        query.search ? or(ilike(products.name, pattern), ilike(suppliers.name, pattern), sql`${purchases.id}::text ilike ${pattern}`) : undefined
      )
      const [rows, totals] = await Promise.all([
        db.select({
          id: purchases.id,
          productId: purchases.productId,
          product: products.name,
          supplierId: purchases.supplierId,
          supplier: suppliers.name,
          quantity: purchases.quantity,
          price: purchases.purchasePrice,
          date: purchases.purchaseDate,
          archivedAt: purchases.archivedAt,
          deletedAt: purchases.deletedAt
        }).from(purchases)
          .innerJoin(products, eq(purchases.productId, products.id))
          .innerJoin(suppliers, eq(purchases.supplierId, suppliers.id))
          .where(where).orderBy(desc(purchases.purchaseDate), desc(purchases.id)).limit(query.limit).offset(query.offset),
        db.select({ total: count() }).from(purchases)
          .innerJoin(products, eq(purchases.productId, products.id))
          .innerJoin(suppliers, eq(purchases.supplierId, suppliers.id))
          .where(where)
      ])
      return {
        section,
        source: 'database' as const,
        data: rows.map(row => ({
          id: String(row.id),
          productoId: String(row.productId),
          producto: row.product,
          proveedorId: String(row.supplierId),
          proveedor: row.supplier,
          cantidad: row.quantity,
          precio: Number(row.price),
          fecha: row.date.toISOString(),
          archivado: row.deletedAt !== null || row.archivedAt !== null,
          deletedAt: row.deletedAt
        })),
        meta: paginationMeta(query.page, query.limit, totals[0]?.total ?? 0)
      }
    }

    case 'precios-proveedor': {
      const where = and(
        softDeleteFilter(supplierPrices, query.archived),
        query.search ? or(ilike(products.name, pattern), ilike(suppliers.name, pattern)) : undefined
      )
      const [rows, totals] = await Promise.all([
        db.select({
          id: supplierPrices.id,
          productId: supplierPrices.productId,
          product: products.name,
          supplierId: supplierPrices.supplierId,
          supplier: suppliers.name,
          price: supplierPrices.purchasePrice,
          validFrom: supplierPrices.validFrom,
          validTo: supplierPrices.validTo,
          archivedAt: supplierPrices.archivedAt,
          deletedAt: supplierPrices.deletedAt
        }).from(supplierPrices)
          .innerJoin(products, eq(supplierPrices.productId, products.id))
          .innerJoin(suppliers, eq(supplierPrices.supplierId, suppliers.id))
          .where(where).orderBy(desc(supplierPrices.validFrom), desc(supplierPrices.id)).limit(query.limit).offset(query.offset),
        db.select({ total: count() }).from(supplierPrices)
          .innerJoin(products, eq(supplierPrices.productId, products.id))
          .innerJoin(suppliers, eq(supplierPrices.supplierId, suppliers.id))
          .where(where)
      ])
      return {
        section,
        source: 'database' as const,
        data: rows.map(row => ({
          id: String(row.id),
          productoId: String(row.productId),
          producto: row.product,
          proveedorId: String(row.supplierId),
          proveedor: row.supplier,
          precio: Number(row.price),
          desde: row.validFrom?.toISOString() ?? '',
          hasta: row.validTo?.toISOString() ?? '',
          archivado: row.deletedAt !== null || row.archivedAt !== null,
          deletedAt: row.deletedAt
        })),
        meta: paginationMeta(query.page, query.limit, totals[0]?.total ?? 0)
      }
    }

    case 'precios-maceta': {
      const where = and(
        softDeleteFilter(plantPotPrices, query.archived),
        query.search ? or(ilike(products.name, pattern), ilike(plantPotPrices.potSize, pattern)) : undefined
      )
      const [rows, totals] = await Promise.all([
        db.select({
          id: plantPotPrices.id,
          productId: plantPotPrices.productId,
          product: products.name,
          size: plantPotPrices.potSize,
          price: plantPotPrices.price,
          archivedAt: plantPotPrices.archivedAt,
          deletedAt: plantPotPrices.deletedAt
        }).from(plantPotPrices)
          .innerJoin(products, eq(plantPotPrices.productId, products.id))
          .where(where).orderBy(asc(products.name), asc(plantPotPrices.potSize), asc(plantPotPrices.id)).limit(query.limit).offset(query.offset),
        db.select({ total: count() }).from(plantPotPrices)
          .innerJoin(products, eq(plantPotPrices.productId, products.id))
          .where(where)
      ])
      return {
        section,
        source: 'database' as const,
        data: rows.map(row => ({
          id: String(row.id),
          productoId: String(row.productId),
          producto: row.product,
          medida: row.size,
          precio: Number(row.price),
          archivado: row.deletedAt !== null || row.archivedAt !== null,
          deletedAt: row.deletedAt
        })),
        meta: paginationMeta(query.page, query.limit, totals[0]?.total ?? 0)
      }
    }

    case 'ubicaciones': {
      const where = and(
        softDeleteFilter(locations, query.archived),
        query.search ? or(ilike(locations.name, pattern), ilike(locations.area, pattern)) : undefined,
        query.status ? eq(locations.status, query.status) : undefined
      )
      const [rows, totals] = await Promise.all([
        db.select().from(locations).where(where).orderBy(asc(locations.name), asc(locations.id)).limit(query.limit).offset(query.offset),
        db.select({ total: count() }).from(locations).where(where)
      ])
      return {
        section,
        source: 'database' as const,
        data: rows.map(row => ({
          id: String(row.id),
          nombre: row.name,
          area: row.area ?? '',
          monitoreada: row.isMonitored,
          x: row.x,
          y: row.y,
          estado: row.status,
          archivado: row.deletedAt !== null || row.archivedAt !== null,
          deletedAt: row.deletedAt
        })),
        meta: paginationMeta(query.page, query.limit, totals[0]?.total ?? 0)
      }
    }

    case 'zonas': {
      const where = and(
        softDeleteFilter(zones, query.archived),
        query.search ? or(ilike(zones.name, pattern), ilike(zones.color, pattern)) : undefined
      )
      const [rows, totals] = await Promise.all([
        db.select().from(zones).where(where).orderBy(asc(zones.name), asc(zones.id)).limit(query.limit).offset(query.offset),
        db.select({ total: count() }).from(zones).where(where)
      ])
      return {
        section,
        source: 'database' as const,
        data: rows.map(row => ({
          id: row.id,
          nombre: row.name,
          x: row.x,
          y: row.y,
          ancho: row.width,
          alto: row.height,
          color: row.color,
          archivado: row.deletedAt !== null || row.archivedAt !== null,
          deletedAt: row.deletedAt
        })),
        meta: paginationMeta(query.page, query.limit, totals[0]?.total ?? 0)
      }
    }
  }
})
