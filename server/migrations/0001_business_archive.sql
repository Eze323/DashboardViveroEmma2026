BEGIN;

ALTER TABLE products ADD COLUMN IF NOT EXISTS archived_at timestamp without time zone;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS archived_at timestamp without time zone;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS archived_at timestamp without time zone;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS archived_at timestamp without time zone;
ALTER TABLE supplier_prices ADD COLUMN IF NOT EXISTS archived_at timestamp without time zone;
ALTER TABLE plant_pot_prices ADD COLUMN IF NOT EXISTS archived_at timestamp without time zone;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS archived_at timestamp without time zone;
ALTER TABLE zones ADD COLUMN IF NOT EXISTS archived_at timestamp without time zone;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS inventory_applied_at timestamp without time zone;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS pot_size varchar(50);
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS archived_at timestamp without time zone;

CREATE INDEX IF NOT EXISTS products_active_name_idx ON products (name, id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS customers_active_name_idx ON customers (name, id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS suppliers_active_name_idx ON suppliers (name, id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS purchases_active_date_idx ON purchases (purchase_date DESC, id DESC) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS supplier_prices_active_valid_idx ON supplier_prices (valid_from DESC, id DESC) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS plant_pot_prices_active_product_idx ON plant_pot_prices (product_id, id) WHERE archived_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS plant_pot_prices_active_size_idx ON plant_pot_prices (product_id, pot_size) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS locations_active_name_idx ON locations (name, id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS zones_active_name_idx ON zones (name, id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS sales_date_id_idx ON sales (date DESC, id DESC);
CREATE INDEX IF NOT EXISTS sale_items_active_sale_idx ON sale_items (sale_id, id) WHERE archived_at IS NULL;

UPDATE products
SET sku = 'VE-' || lpad(id::text, 6, '0')
WHERE sku IS NULL OR btrim(sku) = '';

COMMIT;
