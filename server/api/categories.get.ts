import { and, asc, isNull } from 'drizzle-orm'
import { categories } from '../../src/db/schema'
import { useDrizzle } from '../utils/drizzle'

export default defineCachedEventHandler(async () => {
  const rows = await useDrizzle().select({
    id: categories.id,
    name: categories.name
  }).from(categories)
    .where(and(isNull(categories.deletedAt), isNull(categories.archivedAt)))
    .orderBy(asc(categories.name))

  return {
    data: rows.map(row => ({ id: String(row.id), nombre: row.name }))
  }
}, {
  name: 'categories',
  maxAge: 300,
  swr: true
})
