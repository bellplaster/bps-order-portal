PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS customer_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  debtor_code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  company_name TEXT NOT NULL,
  default_contact_name TEXT NOT NULL DEFAULT '',
  default_mobile TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL DEFAULT 210000,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'customer')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (account_id) REFERENCES customer_accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_users_account_id ON users(account_id);
CREATE INDEX IF NOT EXISTS idx_users_active_username ON users(active, username);

INSERT OR IGNORE INTO customer_accounts (
  debtor_code,
  company_name,
  default_contact_name,
  default_mobile,
  active,
  created_at,
  updated_at
) VALUES (
  'BPS BRUNSW17',
  'BPS Brunswick Plastering Services',
  '',
  '',
  1,
  datetime('now'),
  datetime('now')
);

ALTER TABLE orders ADD COLUMN account_id INTEGER;
ALTER TABLE orders ADD COLUMN debtor_code_snapshot TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN company_name_snapshot TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN contact_snapshot TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN mobile_snapshot TEXT NOT NULL DEFAULT '';

UPDATE orders
SET account_id = (
      SELECT id
      FROM customer_accounts
      WHERE debtor_code = 'BPS BRUNSW17'
      LIMIT 1
    ),
    debtor_code_snapshot = CASE
      WHEN debtor_code_snapshot = '' THEN 'BPS BRUNSW17'
      ELSE debtor_code_snapshot
    END,
    company_name_snapshot = CASE
      WHEN company_name_snapshot = '' THEN 'BPS Brunswick Plastering Services'
      ELSE company_name_snapshot
    END
WHERE account_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_account_created
  ON orders(account_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_account_reference
  ON orders(account_id, customer_reference)
  WHERE customer_reference <> '';
