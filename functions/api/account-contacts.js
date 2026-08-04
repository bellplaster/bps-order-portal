import { cleanPersonName } from "../_shared/account-field-validation.js";
import { normaliseAustralianPhone } from "../_shared/phone.js";
import { json } from "../_shared/responses.js";

const MIGRATION_KEY = "account_saved_contacts_v1";

export async function onRequestGet(context) {
  try {
    const auth = requireAuth(context);
    await ensureContactSchema(context.env.DB);
    const accountId = Number(auth.accountId || 0);
    if (!accountId) return json({ ok: true, contacts: [], canManage: false });

    const canManage = await userCanManage(context.env.DB, auth);
    const result = await context.env.DB.prepare(
      `SELECT id, contact_name, mobile, created_at, updated_at
       FROM account_contacts
       WHERE account_id = ? AND active = 1
       ORDER BY contact_name COLLATE NOCASE, mobile`,
    ).bind(accountId).all();

    return json({
      ok: true,
      canManage,
      contacts: (result.results || []).map(toContact),
    });
  } catch (error) {
    return fail(error);
  }
}

export async function onRequestPost(context) {
  try {
    const auth = requireAuth(context);
    await ensureContactSchema(context.env.DB);
    await requireManager(context.env.DB, auth);
    const body = await readBody(context);
    const contactName = cleanName(body.contactName);
    const mobile = cleanPhone(body.mobile);
    const now = new Date().toISOString();

    const existing = await context.env.DB.prepare(
      `SELECT id FROM account_contacts
       WHERE account_id = ? AND contact_name = ? COLLATE NOCASE AND mobile = ?
       LIMIT 1`,
    ).bind(Number(auth.accountId), contactName, mobile).first();

    if (existing?.id) {
      await context.env.DB.prepare(
        `UPDATE account_contacts
         SET active = 1, updated_by_user_id = ?, updated_at = ?
         WHERE id = ? AND account_id = ?`,
      ).bind(Number(auth.userId), now, Number(existing.id), Number(auth.accountId)).run();
      return json({ ok: true, contactId: Number(existing.id) });
    }

    const result = await context.env.DB.prepare(
      `INSERT INTO account_contacts (
         account_id, contact_name, mobile, active,
         created_by_user_id, updated_by_user_id, created_at, updated_at
       ) VALUES (?, ?, ?, 1, ?, ?, ?, ?)`,
    ).bind(
      Number(auth.accountId),
      contactName,
      mobile,
      Number(auth.userId),
      Number(auth.userId),
      now,
      now,
    ).run();

    return json({ ok: true, contactId: Number(result?.meta?.last_row_id || 0) }, 201);
  } catch (error) {
    return fail(error);
  }
}

export async function onRequestPut(context) {
  try {
    const auth = requireAuth(context);
    await ensureContactSchema(context.env.DB);
    await requireManager(context.env.DB, auth);
    const body = await readBody(context);
    const contactId = Number(body.contactId || 0);
    if (!contactId) throw badRequest("Choose a saved contact.");
    const contactName = cleanName(body.contactName);
    const mobile = cleanPhone(body.mobile);

    const duplicate = await context.env.DB.prepare(
      `SELECT id FROM account_contacts
       WHERE account_id = ? AND contact_name = ? COLLATE NOCASE AND mobile = ? AND id <> ?
       LIMIT 1`,
    ).bind(Number(auth.accountId), contactName, mobile, contactId).first();
    if (duplicate?.id) throw conflict("That saved contact already exists.");

    const result = await context.env.DB.prepare(
      `UPDATE account_contacts
       SET contact_name = ?, mobile = ?, active = 1,
           updated_by_user_id = ?, updated_at = ?
       WHERE id = ? AND account_id = ?`,
    ).bind(
      contactName,
      mobile,
      Number(auth.userId),
      new Date().toISOString(),
      contactId,
      Number(auth.accountId),
    ).run();
    if (!Number(result?.meta?.changes || 0)) throw notFound("Saved contact not found.");

    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}

export async function onRequestDelete(context) {
  try {
    const auth = requireAuth(context);
    await ensureContactSchema(context.env.DB);
    await requireManager(context.env.DB, auth);
    const url = new URL(context.request.url);
    const contactId = Number(url.searchParams.get("id") || 0);
    if (!contactId) throw badRequest("Choose a saved contact.");

    const result = await context.env.DB.prepare(
      `UPDATE account_contacts
       SET active = 0, updated_by_user_id = ?, updated_at = ?
       WHERE id = ? AND account_id = ? AND active = 1`,
    ).bind(
      Number(auth.userId),
      new Date().toISOString(),
      contactId,
      Number(auth.accountId),
    ).run();
    if (!Number(result?.meta?.changes || 0)) throw notFound("Saved contact not found.");

    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}

async function ensureContactSchema(db) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS account_contacts (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       account_id INTEGER NOT NULL,
       contact_name TEXT NOT NULL,
       mobile TEXT NOT NULL DEFAULT '',
       active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
       created_by_user_id INTEGER,
       updated_by_user_id INTEGER,
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL,
       FOREIGN KEY (account_id) REFERENCES customer_accounts(id),
       FOREIGN KEY (created_by_user_id) REFERENCES users(id),
       FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
     )`,
  ).run();
  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_account_contacts_active_name
     ON account_contacts(account_id, active, contact_name COLLATE NOCASE)`,
  ).run();
  await db.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_account_contacts_unique
     ON account_contacts(account_id, contact_name COLLATE NOCASE, mobile)`,
  ).run();
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS portal_settings (
       key TEXT PRIMARY KEY,
       value TEXT NOT NULL,
       updated_at TEXT NOT NULL
     )`,
  ).run();

  const migration = await db.prepare(
    `SELECT value FROM portal_settings WHERE key = ? LIMIT 1`,
  ).bind(MIGRATION_KEY).first();
  if (migration?.value === "complete") return;

  const now = new Date().toISOString();
  await db.prepare(
    `INSERT OR IGNORE INTO account_contacts (
       account_id, contact_name, mobile, active,
       created_by_user_id, updated_by_user_id, created_at, updated_at
     )
     SELECT u.account_id,
            TRIM(u.default_contact_name),
            TRIM(COALESCE(u.default_mobile, '')),
            1, u.id, u.id, ?, ?
     FROM users u
     WHERE u.role = 'customer'
       AND u.active = 1
       AND u.account_id IS NOT NULL
       AND TRIM(COALESCE(u.default_contact_name, '')) <> ''`,
  ).bind(now, now).run();

  await db.prepare(
    `INSERT OR REPLACE INTO portal_settings (key, value, updated_at)
     VALUES (?, 'complete', ?)`,
  ).bind(MIGRATION_KEY, now).run();
}

async function userCanManage(db, auth) {
  if (!auth?.userId || !auth?.accountId || auth.role !== "customer") return false;
  const user = await db.prepare(
    `SELECT is_primary FROM users
     WHERE id = ? AND account_id = ? AND role = 'customer' AND active = 1
     LIMIT 1`,
  ).bind(Number(auth.userId), Number(auth.accountId)).first();
  return Number(user?.is_primary || 0) === 1;
}

async function requireManager(db, auth) {
  if (!await userCanManage(db, auth)) {
    throw forbidden("Only the account supervisor can manage saved contacts.");
  }
}

async function readBody(context) {
  const body = await context.request.json().catch(() => null);
  if (!body || typeof body !== "object") throw badRequest("Invalid saved contact request.");
  return body;
}

function cleanName(value) {
  return cleanPersonName(value, { maxLength: 100, label: "Contact name" });
}

function cleanPhone(value) {
  return normaliseAustralianPhone(value, {
    optional: true,
    error: "Enter a valid Australian phone number.",
  });
}

function toContact(row) {
  return {
    id: Number(row.id),
    contactName: String(row.contact_name || "").trim(),
    mobile: String(row.mobile || "").trim(),
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

function requireAuth(context) {
  const auth = context.data?.auth;
  if (!auth?.userId) throw Object.assign(new Error("Authentication required."), { status: 401 });
  return auth;
}

function badRequest(message) { return Object.assign(new Error(message), { status: 400 }); }
function forbidden(message) { return Object.assign(new Error(message), { status: 403 }); }
function notFound(message) { return Object.assign(new Error(message), { status: 404 }); }
function conflict(message) { return Object.assign(new Error(message), { status: 409 }); }
function fail(error) { return json({ ok: false, error: error?.message || String(error) }, Number(error?.status || 500)); }
