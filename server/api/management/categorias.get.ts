import { asc, and, count, eq, ilike } from 'drizzle-orm'
import { categories, products } from '../../../src/db/schema'
import { useDrizzle } from '../../utils/drizzle'
import { paginationMeta, parseManagementQuery } from '../../utils/management'
import { notDeleted } from '../../utils/soft-delete'

export default defineCachedEventHandler(async (event) => {
  const query = parseManagementQuery(event)
  const pattern = `%${query.search.replace(/[\\%_]/g, '\\$&')}%`
  const where = and(
    notDeleted(categories),
    query.search ? ilike(categories.name, pattern) : undefined
  )
  const db = useDrizzle()
  const [rows, totals] = await Promise.all([
    db.select({
      id: categories.id,
      nombre: categories.name,
      productos: count(products.id)
    }).from(categories)
      .leftJoin(products, and(eq(products.categoryId, categories.id), notDeleted(products)))
      .where(where)
      .groupBy(categories.id, categories.name)
      .orderBy(asc(categories.name))
      .limit(query.limit)
      .offset(query.offset),
    db.select({ total: count() }).from(categories).where(where)
  ])

  return {
    section: 'categorias',
    source: 'database' as const,
    data: rows.map(row => ({ id: String(row.id), nombre: row.nombre, productos: row.productos, estado: 'Activa' })),
    meta: paginationMeta(query.page, query.limit, totals[0]?.total ?? 0)
  }
}, {
  name: 'management-categories',
  maxAge: 300,
  swr: true
})
