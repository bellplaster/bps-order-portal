import { USER_ROLES } from "./user-roles.js";

const ROLE_SCHEMA_MARKER = `'${USER_ROLES.CUSTOMER_SERVICE}'`;

export async function ensureUserRoleSchema(db) {
  if (!db) throw new Error("Missing Cloudflare binding: DB");

  const table = await db.prepare(
    `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users' LIMIT 1`,
  ).first();
  if (!table?.sql) return;

  await ensureColumn(db, "users", "is_primary", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "users", "default_contact_name", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, "users", "default_mobile", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, "users", "order_defaults_json", "TEXT NOT NULL DEFAULT '{}'");

  const refreshed = await db.prepare(
    `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users' LIMIT 1`,
  ).first();

  if (!String(refreshed?.sql || "").includes(ROLE_SCHEMA_MARKER)) {
    await rebuildUsersTable(db);
  }

  await db.prepare(
    `UPDATE users
     SET is_primary = 0
     WHERE role <> 'customer' OR account_id IS NULL OR active <> 1`,
  ).run();

  await db.prepare(
    `UPDATE users
     SET is_primary = 0
     WHERE is_primary = 1
       AND id NOT IN (
         SELECT MIN(id) FROM users WHERE is_primary = 1 GROUP BY account_id
       )`,
  ).run();

  await db.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_one_primary_per_account
     ON users(account_id)
     WHERE is_primary = 1 AND role = 'customer'`,
  ).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_users_account_id ON users(account_id)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_users_active_username ON users(active, username)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, active)`).run();
}

async function rebuildUsersTable(db) {
  const statements = [
    db.prepare(`DROP TABLE IF EXISTS users_role_upgrade`),
    db.prepare(`CREATE TABLE users_role_upgrade (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_iterations INTEGER NOT NULL DEFAULT 100000,
      role TEXT NOT NULL DEFAULT 'customer'
        CHECK (role IN ('admin', 'customer', 'customer_service')),
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
      default_contact_name TEXT NOT NULL DEFAULT '',
      default_mobile TEXT NOT NULL DEFAULT '',
      order_defaults_json TEXT NOT NULL DEFAULT '{}',
      last_login_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (account_id) REFERENCES customer_accounts(id)
    )`),
    db.prepare(`INSERT INTO users_role_upgrade (
      id, account_id, username, password_hash, password_salt, password_iterations,
      role, active, is_primary, default_contact_name, default_mobile,
      order_defaults_json, last_login_at, created_at, updated_at
    )
    SELECT
      id, account_id, username, password_hash, password_salt, password_iterations,
      role, active, is_primary, default_contact_name, default_mobile,
      order_defaults_json, last_login_at, created_at, updated_at
    FROM users`),
    db.prepare(`DROP TABLE users`),
    db.prepare(`ALTER TABLE users_role_upgrade RENAME TO users`),
  ];

  await db.batch(statements);
}

async function ensureColumn(db, table, name, definition) {
  const columns = await db.prepare(`PRAGMA table_info(${table})`).all();
  const existing = new Set((columns.results || []).map((row) => String(row.name)));
  if (!existing.has(name)) {
    await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`).run();
  }
}
