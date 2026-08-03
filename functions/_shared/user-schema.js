import { USER_ROLES } from "./user-roles.js";

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
  await ensureColumn(db, "users", "access_role", "TEXT NOT NULL DEFAULT ''");

  await db.prepare(
    `UPDATE users
     SET access_role = CASE
       WHEN role IN (?, ?, ?) THEN role
       ELSE ?
     END
     WHERE TRIM(COALESCE(access_role, '')) = ''
        OR access_role NOT IN (?, ?, ?)`,
  ).bind(
    USER_ROLES.ADMIN,
    USER_ROLES.CUSTOMER,
    USER_ROLES.CUSTOMER_SERVICE,
    USER_ROLES.CUSTOMER,
    USER_ROLES.ADMIN,
    USER_ROLES.CUSTOMER,
    USER_ROLES.CUSTOMER_SERVICE,
  ).run();

  await db.prepare(
    `UPDATE users
     SET is_primary = 0
     WHERE COALESCE(NULLIF(access_role, ''), role) <> 'customer'
        OR account_id IS NULL
        OR active <> 1`,
  ).run();

  await db.prepare(
    `UPDATE users
     SET is_primary = 0
     WHERE is_primary = 1
       AND id NOT IN (
         SELECT MIN(id)
         FROM users
         WHERE is_primary = 1
           AND COALESCE(NULLIF(access_role, ''), role) = 'customer'
         GROUP BY account_id
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
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_users_access_role_active ON users(access_role, active)`).run();
}

async function ensureColumn(db, table, name, definition) {
  const columns = await db.prepare(`PRAGMA table_info(${table})`).all();
  const existing = new Set((columns.results || []).map((row) => String(row.name)));
  if (!existing.has(name)) {
    await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`).run();
  }
}
