PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS orders (
  submission_id TEXT PRIMARY KEY,
  customer_reference TEXT NOT NULL DEFAULT '',
  job_name TEXT NOT NULL DEFAULT '',
  site_address_1 TEXT NOT NULL DEFAULT '',
  site_address_2 TEXT NOT NULL DEFAULT '',
  requester_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  current_stage TEXT,
  error_message TEXT,
  error_stack TEXT,
  email_status TEXT,
  email_response TEXT,
  raw_payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_status
  ON orders(status);

CREATE TABLE IF NOT EXISTS order_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id TEXT NOT NULL,
  floor TEXT NOT NULL,
  floor_label TEXT NOT NULL,
  filename TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  item_count INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (submission_id)
    REFERENCES orders(submission_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_order_files_submission
  ON order_files(submission_id);

CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (submission_id)
    REFERENCES orders(submission_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_order_events_submission
  ON order_events(submission_id, id DESC);
