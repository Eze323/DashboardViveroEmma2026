import { and, desc, gte, lte, notInArray, sql, sum } from 'drizzle-orm'
import { getQuery } from 'h3'
import { customers, products, sales } from '../../src/db/schema'
import { useDrizzle } from '../utils/drizzle'

function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function shiftDate(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00.000Z`)
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return shifted.toISOString().slice(0, 10)
}

function argentinaDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const today = argentinaDate()
  const from = query.from === undefined ? shiftDate(today, -14) : query.from
  const to = query.to === undefined ? today : query.to

  if (!isValidDate(from) || !isValidDate(to) || from > to) {
    throw createError({
      statusCode: 400,
      statusMessage: 'El rango de fechas no es válido.'
    })
  }

  const db = useDrizzle()
  const rangeFilter = and(gte(sales.date, from), lte(sales.date, to), notInArray(sales.status, ['Anulada', 'Cancelada']))
  const monthStart = `${today.slice(0, 7)}-01`
  const [metrics, dailySales, recentSales] = await Promise.all([
    db.select({
      todaySales: sql<number>`count(*) filter (where ${sales.date} = ${today} and ${sales.status} not in ('Anulada', 'Cancelada'))::int`,
      products: sql<number>`(select count(*)::int from ${products} where archived_at is null)`,
      monthlyRevenue: sql<number>`coalesce(sum(${sales.totalPrice}) filter (where ${sales.date} >= ${monthStart} and ${sales.date} <= ${today} and ${sales.status} not in ('Anulada', 'Cancelada')), 0)::float8`,
      customers: sql<number>`(select count(*)::int from ${customers} where archived_at is null)`
    }).from(sales),
    db.select({
      date: sales.date,
      amount: sum(sales.totalPrice)
    }).from(sales).where(rangeFilter).groupBy(sales.date).orderBy(sales.date),
    db.select({
      id: sales.id,
      date: sales.date,
      time: sales.time,
      status: sales.status,
      clientName: sales.customer,
      amount: sales.totalPrice
    }).from(sales).where(rangeFilter).orderBy(desc(sales.date), desc(sales.createdAt)).limit(10)
  ])

  return {
    stats: {
      todaySales: metrics[0]?.todaySales ?? 0,
      products: metrics[0]?.products ?? 0,
      monthlyRevenue: metrics[0]?.monthlyRevenue ?? 0,
      customers: metrics[0]?.customers ?? 0
    },
    salesByDate: dailySales.map(row => ({
      date: row.date,
      amount: Number(row.amount ?? 0)
    })),
    recentSales: recentSales.map(sale => ({
      id: String(sale.id),
      date: sale.date,
      time: sale.time,
      status: sale.status,
      clientName: sale.clientName,
      amount: Number(sale.amount)
    }))
  }
})
