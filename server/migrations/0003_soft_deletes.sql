BEGIN;

-- 1. Agregar columna deleted_at a las tablas principales
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at timestamp without time zone;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_at timestamp without time zone;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS deleted_at timestamp without time zone;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS deleted_at timestamp without time zone;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS deleted_at timestamp without time zone;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS deleted_at timestamp without time zone;
ALTER TABLE supplier_prices ADD COLUMN IF NOT EXISTS deleted_at timestamp without time zone;
ALTER TABLE plant_pot_prices ADD COLUMN IF NOT EXISTS deleted_at timestamp without time zone;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS deleted_at timestamp without time zone;
ALTER TABLE zones ADD COLUMN IF NOT EXISTS deleted_at timestamp without time zone;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamp without time zone;

-- 2. Migración segura de datos existentes (Sincronizar archivados previos a deleted_at)
UPDATE products SET deleted_at = archived_at WHERE archived_at IS NOT NULL AND deleted_at IS NULL;
UPDATE customers SET deleted_at = archived_at WHERE archived_at IS NOT NULL AND deleted_at IS NULL;
UPDATE suppliers SET deleted_at = archived_at WHERE archived_at IS NOT NULL AND deleted_at IS NULL;
UPDATE purchases SET deleted_at = archived_at WHERE archived_at IS NOT NULL AND deleted_at IS NULL;
UPDATE supplier_prices SET deleted_at = archived_at WHERE archived_at IS NOT NULL AND deleted_at IS NULL;
UPDATE plant_pot_prices SET deleted_at = archived_at WHERE archived_at IS NOT NULL AND deleted_at IS NULL;
UPDATE locations SET deleted_at = archived_at WHERE archived_at IS NOT NULL AND deleted_at IS NULL;
UPDATE zones SET deleted_at = archived_at WHERE archived_at IS NOT NULL AND deleted_at IS NULL;
UPDATE sale_items SET deleted_at = archived_at WHERE archived_at IS NOT NULL AND deleted_at IS NULL;

-- 3. Índices parciales para consultas de alto rendimiento con deleted_at IS NULL
CREATE INDEX IF NOT EXISTS products_active_deleted_idx ON products (name, id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS customers_active_deleted_idx ON customers (name, id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS sales_active_deleted_idx ON sales (date DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS sale_items_active_deleted_idx ON sale_items (sale_id, id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS suppliers_active_deleted_idx ON suppliers (name, id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS purchases_active_deleted_idx ON purchases (purchase_date DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS supplier_prices_active_deleted_idx ON supplier_prices (valid_from DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS plant_pot_prices_active_deleted_idx ON plant_pot_prices (product_id, pot_size) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS locations_active_deleted_idx ON locations (name, id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS zones_active_deleted_idx ON zones (name, id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS users_active_deleted_idx ON users (email) WHERE deleted_at IS NULL;

COMMIT;
