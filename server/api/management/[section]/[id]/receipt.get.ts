import { and, eq, isNull, sql } from 'drizzle-orm'
import { getRouterParam } from 'h3'
import { customers, products, saleItems, sales } from '../../../../../src/db/schema'
import { useDrizzle } from '../../../../utils/drizzle'
import { managementSections, parsePositiveId } from '../../../../utils/management'

export default defineEventHandler(async (event) => {
  const section = getRouterParam(event, 'section') ?? ''
  if (section !== 'ventas' && section !== 'facturas') {
    throw createError({ statusCode: 404, statusMessage: 'No existe un comprobante para esta sección.' })
  }

  const id = parsePositiveId(getRouterParam(event, 'id'))
  if (!managementSections.includes(section as typeof managementSections[number])) {
    throw createError({ statusCode: 404, statusMessage: 'La sección solicitada no existe.' })
  }
  const db = useDrizzle()
  const [sale] = await db.select({
    id: sales.id,
    date: sales.date,
    time: sales.time,
    customer: sales.customer,
    email: sales.email,
    seller: sales.seller,
    total: sales.totalPrice,
    status: sales.status,
    invoiceType: sales.invoiceType,
    invoiceNumber: sales.invoiceNumber,
    cae: sales.cae,
    billingStatus: sales.billingStatus,
    customerAddress: customers.address,
    customerTaxId: customers.taxId,
    customerIvaCondition: sales.customerIvaCondition
  }).from(sales).leftJoin(customers, eq(sales.customerId, customers.id)).where(eq(sales.id, id)).limit(1)

  if (!sale) throw createError({ statusCode: 404, statusMessage: 'Venta no encontrada.' })
  if (sale.cae || sale.billingStatus === 'billed') {
    throw createError({ statusCode: 409, statusMessage: 'El comprobante fiscal emitido debe compartirse desde el sistema de facturación autorizado.' })
  }

  const items = await db.select({
    productId: saleItems.productId,
    name: sql<string>`coalesce(${products.name}, 'Producto')`,
    size: saleItems.potSize,
    quantity: saleItems.quantity,
    price: saleItems.unitPrice,
    subtotal: sql<number>`${saleItems.quantity} * ${saleItems.unitPrice}`
  }).from(saleItems).leftJoin(products, eq(saleItems.productId, products.id))
    .where(and(eq(saleItems.saleId, id), isNull(saleItems.archivedAt)))

  return {
    nonFiscal: true,
    id: String(sale.id),
    date: sale.date,
    time: sale.time,
    customer: sale.customer,
    email: sale.email ?? '',
    address: sale.customerAddress ?? '',
    taxId: sale.customerTaxId ?? '',
    ivaCondition: sale.customerIvaCondition ?? 'Consumidor Final',
    seller: sale.seller,
    total: Number(sale.total),
    status: sale.status,
    invoiceType: sale.invoiceType ?? 99,
    invoiceNumber: sale.invoiceNumber === null ? '' : String(sale.invoiceNumber),
    items: items.map(item => ({
      productId: item.productId,
      name: item.name,
      size: item.size ?? '',
      quantity: item.quantity,
      price: Number(item.price),
      subtotal: Number(item.subtotal)
    }))
  }
})
