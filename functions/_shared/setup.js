const BPS_DEBTOR_CODE = "BPS BRUNSW17";
const BPS_COMPANY_NAME = "BPS Brunswick Plastering Services";

export async function getOrCreateSessionSecret(env) {
  const configured = String(env.SESSION_SECRET || "").trim();
  if (configured) return configured;
  if (!env.DB) throw new Error("Missing Cloudflare binding: DB");

  await ensureSettingsTable(env.DB);

  const existing = await env.DB.prepare(
    `SELECT value FROM portal_settings WHERE key = 'session_secret' LIMIT 1`,
  ).first();
  if (existing?.value) return String(existing.value);

  const generated = randomSecret();
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO portal_settings (key, value, updated_at)
     VALUES ('session_secret', ?, ?)`,
  ).bind(generated, now).run();

  const saved = await env.DB.prepare(
    `SELECT value FROM portal_settings WHERE key = 'session_secret' LIMIT 1`,
  ).first();
  if (!saved?.value) throw new Error("The portal could not initialize its session key.");
  return String(saved.value);
}

export async function ensurePortalSchema(db) {
  if (!db) throw new Error("Missing Cloudflare binding: DB");

  await ensureSettingsTable(db);

  await db.prepare(
    `CREATE TABLE IF NOT EXISTS customer_accounts (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       debtor_code TEXT NOT NULL UNIQUE COLLATE NOCASE,
       company_name TEXT NOT NULL,
       default_contact_name TEXT NOT NULL DEFAULT '',
       default_mobile TEXT NOT NULL DEFAULT '',
       active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL
     )`,
  ).run();

  await db.prepare(
    `CREATE TABLE IF NOT EXISTS users (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       account_id INTEGER,
       username TEXT NOT NULL UNIQUE COLLATE NOCASE,
       password_hash TEXT NOT NULL,
       password_salt TEXT NOT NULL,
       password_iterations INTEGER NOT NULL DEFAULT 100000,
       role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'customer')),
       active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
       last_login_at TEXT,
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL,
       FOREIGN KEY (account_id) REFERENCES customer_accounts(id)
     )`,
  ).run();

  await db.prepare(
    `CREATE TABLE IF NOT EXISTS orders (
       submission_id TEXT PRIMARY KEY,
       customer_reference TEXT NOT NULL DEFAULT '',
       project_name TEXT NOT NULL DEFAULT '',
       site_address TEXT NOT NULL DEFAULT '',
       suburb_state_postcode TEXT NOT NULL DEFAULT '',
       site_contact TEXT NOT NULL DEFAULT '',
       site_contact_phone TEXT NOT NULL DEFAULT '',
       order_contact TEXT NOT NULL DEFAULT '',
       order_contact_phone TEXT NOT NULL DEFAULT '',
       general_comments TEXT NOT NULL DEFAULT '',
       status TEXT NOT NULL DEFAULT 'processing',
       payload_json TEXT NOT NULL DEFAULT '{}',
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL,
       account_id INTEGER,
       debtor_code_snapshot TEXT NOT NULL DEFAULT '',
       company_name_snapshot TEXT NOT NULL DEFAULT '',
       contact_snapshot TEXT NOT NULL DEFAULT '',
       mobile_snapshot TEXT NOT NULL DEFAULT ''
     )`,
  ).run();

  await db.prepare(
    `CREATE TABLE IF NOT EXISTS order_files (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       submission_id TEXT NOT NULL,
       floor TEXT NOT NULL,
       floor_label TEXT NOT NULL,
       filename TEXT NOT NULL,
       r2_key TEXT NOT NULL UNIQUE,
       item_count INTEGER NOT NULL,
       created_at TEXT NOT NULL,
       FOREIGN KEY (submission_id) REFERENCES orders(submission_id) ON DELETE CASCADE
     )`,
  ).run();

  await db.prepare(
    `CREATE TABLE IF NOT EXISTS order_events (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       submission_id TEXT NOT NULL,
       stage TEXT NOT NULL,
       detail TEXT,
       created_at TEXT NOT NULL,
       FOREIGN KEY (submission_id) REFERENCES orders(submission_id) ON DELETE CASCADE
     )`,
  ).run();

  await ensureColumns(db, "orders", {
    customer_reference: "TEXT NOT NULL DEFAULT ''",
    project_name: "TEXT NOT NULL DEFAULT ''",
    site_address: "TEXT NOT NULL DEFAULT ''",
    suburb_state_postcode: "TEXT NOT NULL DEFAULT ''",
    site_contact: "TEXT NOT NULL DEFAULT ''",
    site_contact_phone: "TEXT NOT NULL DEFAULT ''",
    order_contact: "TEXT NOT NULL DEFAULT ''",
    order_contact_phone: "TEXT NOT NULL DEFAULT ''",
    general_comments: "TEXT NOT NULL DEFAULT ''",
    status: "TEXT NOT NULL DEFAULT 'processing'",
    payload_json: "TEXT NOT NULL DEFAULT '{}'",
    created_at: "TEXT NOT NULL DEFAULT ''",
    updated_at: "TEXT NOT NULL DEFAULT ''",
    account_id: "INTEGER",
    debtor_code_snapshot: "TEXT NOT NULL DEFAULT ''",
    company_name_snapshot: "TEXT NOT NULL DEFAULT ''",
    contact_snapshot: "TEXT NOT NULL DEFAULT ''",
    mobile_snapshot: "TEXT NOT NULL DEFAULT ''",
  });

  const now = new Date().toISOString();
  await db.prepare(
    `INSERT OR IGNORE INTO customer_accounts (
       debtor_code, company_name, default_contact_name, default_mobile,
       active, created_at, updated_at
     ) VALUES (?, ?, '', '', 1, ?, ?)`,
  ).bind(BPS_DEBTOR_CODE, BPS_COMPANY_NAME, now, now).run();

  const account = await db.prepare(
    `SELECT id FROM customer_accounts WHERE debtor_code = ? COLLATE NOCASE LIMIT 1`,
  ).bind(BPS_DEBTOR_CODE).first();
  if (!account?.id) throw new Error("The BPS customer account could not be initialized.");

  await db.prepare(
    `UPDATE orders
     SET account_id = COALESCE(account_id, ?),
         debtor_code_snapshot = CASE WHEN debtor_code_snapshot = '' THEN ? ELSE debtor_code_snapshot END,
         company_name_snapshot = CASE WHEN company_name_snapshot = '' THEN ? ELSE company_name_snapshot END,
         updated_at = CASE WHEN updated_at = '' THEN COALESCE(created_at, ?) ELSE updated_at END
     WHERE account_id IS NULL
        OR debtor_code_snapshot = ''
        OR company_name_snapshot = ''
        OR updated_at = ''`,
  ).bind(Number(account.id), BPS_DEBTOR_CODE, BPS_COMPANY_NAME, now).run();

  const indexStatements = [
    `CREATE INDEX IF NOT EXISTS idx_users_account_id ON users(account_id)`,
    `CREATE INDEX IF NOT EXISTS idx_users_active_username ON users(active, username)`,
    `CREATE INDEX IF NOT EXISTS idx_orders_account_created ON orders(account_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_orders_reference ON orders(customer_reference)`,
    `CREATE INDEX IF NOT EXISTS idx_order_files_submission ON order_files(submission_id)`,
    `CREATE INDEX IF NOT EXISTS idx_order_events_submission ON order_events(submission_id, id DESC)`,
  ];
  for (const sql of indexStatements) await db.prepare(sql).run();

  return { accountId: Number(account.id), debtorCode: BPS_DEBTOR_CODE, companyName: BPS_COMPANY_NAME };
}

async function ensureSettingsTable(db) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS portal_settings (
       key TEXT PRIMARY KEY,
       value TEXT NOT NULL,
       updated_at TEXT NOT NULL
     )`,
  ).run();
}

async function ensureColumns(db, table, definitions) {
  const result = await db.prepare(`PRAGMA table_info(${table})`).all();
  const existing = new Set((result.results || []).map((row) => String(row.name)));
  for (const [name, definition] of Object.entries(definitions)) {
    if (!existing.has(name)) {
      await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`).run();
    }
  }
}

function randomSecret() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
