BEGIN;

CREATE TABLE categories (
  id bigserial PRIMARY KEY,
  name varchar(50) NOT NULL,
  description varchar(500),
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  archived_at timestamp without time zone,
  deleted_at timestamp without time zone
);

CREATE UNIQUE INDEX categories_name_unique ON categories (name);

INSERT INTO categories (name)
SELECT DISTINCT COALESCE(NULLIF(btrim(category), ''), 'Sin categoria')
FROM products
ON CONFLICT (name) DO NOTHING;

ALTER TABLE products ADD COLUMN category_id bigint;

UPDATE products
SET category_id = categories.id
FROM categories
WHERE categories.name = COALESCE(NULLIF(btrim(products.category), ''), 'Sin categoria');

UPDATE products
SET category = categories.name
FROM categories
WHERE products.category_id = categories.id;

ALTER TABLE products ALTER COLUMN category_id SET NOT NULL;
ALTER TABLE products
  ADD CONSTRAINT products_category_id_categories_id_fk
  FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT;
CREATE INDEX products_category_id_idx ON products (category_id);

CREATE TYPE stock_movement_type AS ENUM ('REBOOT_IN', 'SALE', 'MANUAL_ADJUSTMENT');

CREATE TABLE stock_movements (
  id bigserial PRIMARY KEY,
  product_id bigint NOT NULL REFERENCES products (id) ON DELETE RESTRICT,
  type stock_movement_type NOT NULL,
  quantity integer NOT NULL,
  previous_stock integer NOT NULL,
  new_stock integer NOT NULL,
  previous_price numeric(10, 2),
  new_price numeric(10, 2),
  created_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX stock_movements_product_created_idx ON stock_movements (product_id, created_at DESC, id DESC);

COMMIT;
