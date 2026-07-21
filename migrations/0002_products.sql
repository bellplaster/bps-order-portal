-- Accrivia product catalogue used by the searchable Other Materials picker.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS products (
  sku TEXT PRIMARY KEY COLLATE NOCASE,
  description_raw TEXT NOT NULL,
  description_search TEXT NOT NULL,
  search_compact TEXT NOT NULL,
  stock_group TEXT,
  warehouse TEXT,
  available REAL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  import_id TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_active_sku
  ON products(active, sku);

CREATE INDEX IF NOT EXISTS idx_products_import_id
  ON products(import_id);

CREATE TABLE IF NOT EXISTS product_imports (
  import_id TEXT PRIMARY KEY,
  source_name TEXT,
  row_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT
);
