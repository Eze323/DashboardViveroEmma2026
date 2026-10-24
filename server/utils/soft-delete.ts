import { and, isNotNull, isNull } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

/**
 * Interfaz que define entidades con soporte de borrado lógico (Soft Delete).
 */
export interface SoftDeletable {
  deletedAt: AnyPgColumn
}

/**
 * Retorna la condición SQL para filtrar registros activos (no eliminados lógicamente).
 * @example
 * db.select().from(products).where(notDeleted(products))
 * // o pasando la columna directamente:
 * db.select().from(products).where(notDeleted(products.deletedAt))
 */
export function notDeleted(target: SoftDeletable | AnyPgColumn): SQL {
  const column = 'deletedAt' in target ? target.deletedAt : target
  return isNull(column)
}

/**
 * Retorna la condición SQL para filtrar registros marcados como eliminados lógicamente.
 * @example
 * db.select().from(products).where(isDeleted(products))
 */
export function isDeleted(target: SoftDeletable | AnyPgColumn): SQL {
  const column = 'deletedAt' in target ? target.deletedAt : target
  return isNotNull(column)
}

/**
 * Helper flexible para vistas administrativas donde se alterna entre activos y archivados/eliminados.
 * @param target Tabla o columna con deletedAt
 * @param showDeleted Si es true, retorna solo los eliminados; si es false, solo los activos.
 */
export function softDeleteFilter(target: SoftDeletable | AnyPgColumn, showDeleted: boolean): SQL {
  return showDeleted ? isDeleted(target) : notDeleted(target)
}

/**
 * Helper para componer fácilmente `deletedAt IS NULL` con otras condiciones dinámicas de búsqueda o estado.
 * @example
 * const where = withNotDeleted(products, query.search ? ilike(products.name, pattern) : undefined)
 */
export function withNotDeleted(
  target: SoftDeletable | AnyPgColumn,
  ...conditions: (SQL | undefined | null | false)[]
): SQL {
  const activeCondition = notDeleted(target)
  const validConditions = conditions.filter((c): c is SQL => Boolean(c))
  return validConditions.length > 0 ? and(activeCondition, ...validConditions)! : activeCondition
}
