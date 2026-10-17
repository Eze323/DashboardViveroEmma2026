import { isNull, sql } from 'drizzle-orm'
import { getQuery } from 'h3'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

export const managementSections = [
  'productos',
  'clientes',
  'ventas',
  'facturas',
  'categorias',
  'proveedores',
  'vendedores',
  'compras',
  'precios-proveedor',
  'precios-maceta',
  'ubicaciones',
  'zonas',
  'accesos'
] as const

export type ManagementSection = typeof managementSections[number]

export interface ManagementQuery {
  page: number
  limit: number
  offset: number
  search: string
  status: string
  archived: boolean
}

export function parseManagementQuery(event: Parameters<typeof getQuery>[0]): ManagementQuery {
  const query = getQuery(event)
  const page = query.page === undefined ? 1 : Number(query.page)
  const requestedLimit = query.limit === undefined ? 20 : Number(query.limit)

  if (!Number.isSafeInteger(page) || page < 1) {
    throw createError({ statusCode: 400, statusMessage: 'El número de página no es válido.' })
  }
  if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1) {
    throw createError({ statusCode: 400, statusMessage: 'El tamaño de página no es válido.' })
  }
  if (typeof query.q === 'string' && query.q.length > 100) {
    throw createError({ statusCode: 400, statusMessage: 'La búsqueda no puede superar 100 caracteres.' })
  }
  if (typeof query.status === 'string' && query.status.length > 80) {
    throw createError({ statusCode: 400, statusMessage: 'El filtro de estado no es válido.' })
  }
  if (query.archived !== undefined && query.archived !== 'true' && query.archived !== 'false') {
    throw createError({ statusCode: 400, statusMessage: 'El filtro de archivo no es válido.' })
  }

  const limit = Math.min(requestedLimit, 100)
  return {
    page,
    limit,
    offset: (page - 1) * limit,
    search: typeof query.q === 'string' ? query.q.trim() : '',
    status: typeof query.status === 'string' ? query.status : '',
    archived: query.archived === 'true'
  }
}

export function parsePositiveId(value: string | undefined): number {
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id < 1) {
    throw createError({ statusCode: 400, statusMessage: 'El identificador no es válido.' })
  }
  return id
}

export function paginationMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit)
  }
}

export function archiveFilter(column: AnyPgColumn, archived: boolean) {
  return archived ? sql`${column} is not null` : isNull(column)
}

export function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === '23505'
}
