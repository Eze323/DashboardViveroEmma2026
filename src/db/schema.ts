import {
  bigint,
  bigserial,
  boolean,
  date,
  decimal,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  varchar
} from 'drizzle-orm/pg-core'

export const roleEnum = pgEnum('role', ['admin', 'encargado', 'vendedor', 'operario', 'user'])
export const stockMovementTypeEnum = pgEnum('stock_movement_type', ['REBOOT_IN', 'SALE', 'MANUAL_ADJUSTMENT'])

export const categories = pgTable('categories', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  description: varchar('description', { length: 500 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  archivedAt: timestamp('archived_at'),
  deletedAt: timestamp('deleted_at', { mode: 'date' })
}, table => [
  uniqueIndex('categories_name_unique').on(table.name)
])

export const products = pgTable('products', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  categoryId: bigint('category_id', { mode: 'number' }).notNull().references(() => categories.id, { onDelete: 'restrict' }),
  description: varchar('description', { length: 500 }),
  purchasePrice: decimal('precio_compra', { precision: 10, scale: 2 }).notNull(),
  salePrice: decimal('precio_venta', { precision: 10, scale: 2 }).notNull(),
  stock: integer('stock').notNull(),
  potSize: varchar('pot_size', { length: 50 }),
  imageUrl: varchar('image_url', { length: 255 }),
  published: boolean('publicado').notNull(),
  sku: varchar('sku', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  archivedAt: timestamp('archived_at'),
  deletedAt: timestamp('deleted_at', { mode: 'date' })
})

export const stockMovements = pgTable('stock_movements', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  productId: bigint('product_id', { mode: 'number' }).notNull().references(() => products.id, { onDelete: 'restrict' }),
  type: stockMovementTypeEnum('type').notNull(),
  quantity: integer('quantity').notNull(),
  previousStock: integer('previous_stock').notNull(),
  newStock: integer('new_stock').notNull(),
  previousPrice: decimal('previous_price', { precision: 10, scale: 2 }),
  newPrice: decimal('new_price', { precision: 10, scale: 2 }),
  createdAt: timestamp('created_at').notNull().defaultNow()
})

export const customers = pgTable('customers', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  address: varchar('address', { length: 500 }),
  phone: varchar('phone', { length: 20 }),
  taxId: varchar('tax_id', { length: 20 }),
  ivaCondition: varchar('iva_condition', { length: 50 }),
  fiscalAddress: text('fiscal_address'),
  archivedAt: timestamp('archived_at'),
  deletedAt: timestamp('deleted_at', { mode: 'date' })
})

export const sales = pgTable('sales', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: bigint('user_id', { mode: 'number' }).notNull(),
  customerId: bigint('customer_id', { mode: 'number' }),
  customer: varchar('customer', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  seller: varchar('seller', { length: 255 }).notNull(),
  date: date('date').notNull(),
  time: time('time'),
  status: varchar('status', { length: 255 }).notNull(),
  totalPrice: decimal('total_price', { precision: 10, scale: 2 }).notNull(),
  invoiceType: integer('invoice_type'),
  pointOfSale: integer('point_of_sale'),
  invoiceNumber: bigint('invoice_number', { mode: 'number' }),
  customerIvaCondition: varchar('customer_iva_condition', { length: 50 }),
  docType: integer('doc_type'),
  docNumber: varchar('doc_number', { length: 20 }),
  netAmount: decimal('net_amount', { precision: 12, scale: 2 }),
  vatAmount: decimal('vat_amount', { precision: 12, scale: 2 }),
  cae: varchar('cae', { length: 20 }),
  caeExpiration: date('cae_expiration'),
  billingStatus: varchar('billing_status', { length: 20 }),
  inventoryAppliedAt: timestamp('inventory_applied_at'),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
  deletedAt: timestamp('deleted_at', { mode: 'date' })
})

export const saleItems = pgTable('sale_items', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  saleId: bigint('sale_id', { mode: 'number' }).notNull(),
  productId: bigint('product_id', { mode: 'number' }).notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  potSize: varchar('pot_size', { length: 50 }),
  archivedAt: timestamp('archived_at'),
  deletedAt: timestamp('deleted_at', { mode: 'date' })
})

export const suppliers = pgTable('suppliers', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  archivedAt: timestamp('archived_at'),
  deletedAt: timestamp('deleted_at', { mode: 'date' })
})

export const purchases = pgTable('purchases', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  productId: bigint('product_id', { mode: 'number' }).notNull(),
  supplierId: bigint('supplier_id', { mode: 'number' }).notNull(),
  quantity: integer('quantity').notNull(),
  purchasePrice: decimal('purchase_price', { precision: 10, scale: 2 }).notNull(),
  purchaseDate: timestamp('purchase_date').notNull(),
  archivedAt: timestamp('archived_at'),
  deletedAt: timestamp('deleted_at', { mode: 'date' })
})

export const supplierPrices = pgTable('supplier_prices', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  productId: bigint('product_id', { mode: 'number' }).notNull(),
  supplierId: bigint('supplier_id', { mode: 'number' }).notNull(),
  purchasePrice: decimal('purchase_price', { precision: 10, scale: 2 }).notNull(),
  validFrom: timestamp('valid_from'),
  validTo: timestamp('valid_to'),
  archivedAt: timestamp('archived_at'),
  deletedAt: timestamp('deleted_at', { mode: 'date' })
})

export const plantPotPrices = pgTable('plant_pot_prices', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  productId: bigint('product_id', { mode: 'number' }).notNull(),
  potSize: varchar('pot_size', { length: 50 }).notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  archivedAt: timestamp('archived_at'),
  deletedAt: timestamp('deleted_at', { mode: 'date' })
})

export const locations = pgTable('locations', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  area: varchar('area', { length: 255 }),
  isMonitored: boolean('is_monitored').notNull().default(true),
  x: integer('x').notNull().default(0),
  y: integer('y').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  status: varchar('status', { length: 255 }).notNull().default('active'),
  archivedAt: timestamp('archived_at'),
  deletedAt: timestamp('deleted_at', { mode: 'date' })
})

export const zones = pgTable('zones', {
  id: varchar('id', { length: 255 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  x: integer('x').notNull(),
  y: integer('y').notNull(),
  width: integer('w').notNull(),
  height: integer('h').notNull(),
  color: varchar('color', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  archivedAt: timestamp('archived_at'),
  deletedAt: timestamp('deleted_at', { mode: 'date' })
})

export const users = pgTable('users', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  password: varchar('password', { length: 255 }).notNull(),
  role: roleEnum('role'),
  createdAt: timestamp('created_at'),
  deletedAt: timestamp('deleted_at', { mode: 'date' })
})

export const authLoginAttempts = pgTable('auth_login_attempts', {
  key: varchar('key', { length: 64 }).primaryKey(),
  failureCount: integer('failure_count').notNull().default(0),
  windowStartedAt: timestamp('window_started_at', { mode: 'date' }).notNull().defaultNow(),
  lockedUntil: timestamp('locked_until', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow()
})

export const auditLogs = pgTable('audit_logs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: bigint('user_id', { mode: 'number' }).notNull().references(() => users.id),
  action: varchar('action', { length: 100 }).notNull(),
  entity: varchar('entity', { length: 100 }).notNull(),
  entityId: varchar('entity_id', { length: 255 }).notNull(),
  details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at').notNull().defaultNow()
})
