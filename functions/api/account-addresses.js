import { json } from "../_shared/responses.js";

export async function onRequestGet(context) {
  try {
    const auth = requireAuth(context);
    await ensureAddressSchema(context.env.DB);
    const accountId = Number(auth.accountId || 0);
    if (!accountId) return json({ ok: true, addresses: [], canManage: false });

    const canManage = await userCanManage(context.env.DB, auth);
    if (canManage) await seedAddressFromOrderDefaults(context.env.DB, auth);

    const result = await context.env.DB.prepare(
      `SELECT id, label, address_line_1, suburb, state, postcode,
              formatted_address, is_default, created_at, updated_at
       FROM account_addresses
       WHERE account_id = ? AND active = 1
       ORDER BY is_default DESC, label COLLATE NOCASE, formatted_address COLLATE NOCASE`,
    ).bind(accountId).all();

    return json({
      ok: true,
      canManage,
      addresses: (result.results || []).map(toAddress),
    });
  } catch (error) {
    return fail(error);
  }
}

export async function onRequestPost(context) {
  try {
    const auth = requireAuth(context);
    await ensureAddressSchema(context.env.DB);
    await requireManager(context.env.DB, auth);
    const body = await readBody(context);
    const address = cleanAddressInput(body);
    const accountId = Number(auth.accountId);
    const now = new Date().toISOString();

    await assertNotDuplicate(context.env.DB, accountId, address);
    const activeCount = await context.env.DB.prepare(
      `SELECT COUNT(*) AS count FROM account_addresses WHERE account_id = ? AND active = 1`,
    ).bind(accountId).first();
    const isDefault = address.isDefault || Number(activeCount?.count || 0) === 0;

    if (isDefault) await clearDefault(context.env.DB, accountId, now, auth.userId);

    const result = await context.env.DB.prepare(
      `INSERT INTO account_addresses (
         account_id, label, address_line_1, suburb, state, postcode,
         formatted_address, is_default, active,
         created_by_user_id, updated_by_user_id, created_at, updated_at
       ) VALUES (?, ?, ?, ?, 'VIC', ?, ?, ?, 1, ?, ?, ?, ?)`,
    ).bind(
      accountId,
      address.label,
      address.street,
      address.suburb,
      address.postcode,
      address.formattedAddress,
      isDefault ? 1 : 0,
      Number(auth.userId),
      Number(auth.userId),
      now,
      now,
    ).run();

    return json({ ok: true, addressId: Number(result?.meta?.last_row_id || 0) }, 201);
  } catch (error) {
    return fail(error);
  }
}

export async function onRequestPut(context) {
  try {
    const auth = requireAuth(context);
    await ensureAddressSchema(context.env.DB);
    await requireManager(context.env.DB, auth);
    const body = await readBody(context);
    const addressId = Number(body.addressId || 0);
    if (!addressId) throw badRequest("Choose a saved address.");

    const accountId = Number(auth.accountId);
    const address = cleanAddressInput(body);
    const existing = await context.env.DB.prepare(
      `SELECT id, is_default FROM account_addresses
       WHERE id = ? AND account_id = ? AND active = 1 LIMIT 1`,
    ).bind(addressId, accountId).first();
    if (!existing) throw notFound("Saved address not found.");

    await assertNotDuplicate(context.env.DB, accountId, address, addressId);
    const now = new Date().toISOString();
    const isDefault = address.isDefault || Number(existing.is_default || 0) === 1;
    if (isDefault) await clearDefault(context.env.DB, accountId, now, auth.userId);

    const result = await context.env.DB.prepare(
      `UPDATE account_addresses
       SET label = ?, address_line_1 = ?, suburb = ?, state = 'VIC', postcode = ?,
           formatted_address = ?, is_default = ?, updated_by_user_id = ?, updated_at = ?
       WHERE id = ? AND account_id = ? AND active = 1`,
    ).bind(
      address.label,
      address.street,
      address.suburb,
      address.postcode,
      address.formattedAddress,
      isDefault ? 1 : 0,
      Number(auth.userId),
      now,
      addressId,
      accountId,
    ).run();
    if (!Number(result?.meta?.changes || 0)) throw notFound("Saved address not found.");

    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}

export async function onRequestPatch(context) {
  try {
    const auth = requireAuth(context);
    await ensureAddressSchema(context.env.DB);
    await requireManager(context.env.DB, auth);
    const body = await readBody(context);
    const addressId = Number(body.addressId || 0);
    if (!addressId) throw badRequest("Choose a saved address.");

    const accountId = Number(auth.accountId);
    const existing = await context.env.DB.prepare(
      `SELECT id FROM account_addresses
       WHERE id = ? AND account_id = ? AND active = 1 LIMIT 1`,
    ).bind(addressId, accountId).first();
    if (!existing) throw notFound("Saved address not found.");

    const now = new Date().toISOString();
    await clearDefault(context.env.DB, accountId, now, auth.userId);
    await context.env.DB.prepare(
      `UPDATE account_addresses
       SET is_default = 1, updated_by_user_id = ?, updated_at = ?
       WHERE id = ? AND account_id = ? AND active = 1`,
    ).bind(Number(auth.userId), now, addressId, accountId).run();

    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}

export async function onRequestDelete(context) {
  try {
    const auth = requireAuth(context);
    await ensureAddressSchema(context.env.DB);
    await requireManager(context.env.DB, auth);
    const url = new URL(context.request.url);
    const addressId = Number(url.searchParams.get("id") || 0);
    if (!addressId) throw badRequest("Choose a saved address.");

    const accountId = Number(auth.accountId);
    const existing = await context.env.DB.prepare(
      `SELECT id, is_default FROM account_addresses
       WHERE id = ? AND account_id = ? AND active = 1 LIMIT 1`,
    ).bind(addressId, accountId).first();
    if (!existing) throw notFound("Saved address not found.");

    const now = new Date().toISOString();
    await context.env.DB.prepare(
      `UPDATE account_addresses
       SET active = 0, is_default = 0, updated_by_user_id = ?, updated_at = ?
       WHERE id = ? AND account_id = ? AND active = 1`,
    ).bind(Number(auth.userId), now, addressId, accountId).run();

    if (Number(existing.is_default || 0) === 1) {
      const replacement = await context.env.DB.prepare(
        `SELECT id FROM account_addresses
         WHERE account_id = ? AND active = 1
         ORDER BY updated_at DESC, id ASC LIMIT 1`,
      ).bind(accountId).first();
      if (replacement?.id) {
        await context.env.DB.prepare(
          `UPDATE account_addresses
           SET is_default = 1, updated_by_user_id = ?, updated_at = ?
           WHERE id = ? AND account_id = ?`,
        ).bind(Number(auth.userId), now, Number(replacement.id), accountId).run();
      }
    }

    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}

export function cleanAddressInput(input) {
  const source = input && typeof input === "object" ? input : {};
  const label = cleanText(source.label, 80);
  const street = cleanText(source.street || source.addressLine1, 240);
  const suburb = cleanText(source.suburb, 120);
  const postcode = String(source.postcode || "").replace(/\D/g, "").slice(0, 4);

  if (!label) throw badRequest("Enter an address name, such as Site office or Warehouse.");
  if (!street) throw badRequest("Enter the street address.");
  if (!suburb) throw badRequest("Enter the suburb.");
  if (!/^(?:3\d{3}|8\d{3})$/.test(postcode)) throw badRequest("Enter a valid Victorian postcode.");

  return {
    label,
    street,
    suburb,
    state: "VIC",
    postcode,
    formattedAddress: `${street}, ${suburb} VIC ${postcode}`,
    isDefault: source.isDefault === true,
  };
}

async function ensureAddressSchema(db) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS account_addresses (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       account_id INTEGER NOT NULL,
       label TEXT NOT NULL,
       address_line_1 TEXT NOT NULL,
       suburb TEXT NOT NULL,
       state TEXT NOT NULL DEFAULT 'VIC',
       postcode TEXT NOT NULL,
       formatted_address TEXT NOT NULL,
       is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
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
    `CREATE INDEX IF NOT EXISTS idx_account_addresses_active_default
     ON account_addresses(account_id, active, is_default DESC, label COLLATE NOCASE)`,
  ).run();
}

async function seedAddressFromOrderDefaults(db, auth) {
  const accountId = Number(auth.accountId || 0);
  if (!accountId) return;

  const existing = await db.prepare(
    `SELECT id FROM account_addresses WHERE account_id = ? AND active = 1 LIMIT 1`,
  ).bind(accountId).first();
  if (existing?.id) return;

  const user = await db.prepare(
    `SELECT order_defaults_json FROM users
     WHERE id = ? AND account_id = ? AND active = 1 LIMIT 1`,
  ).bind(Number(auth.userId), accountId).first();
  if (!user?.order_defaults_json) return;

  let defaults = {};
  try {
    defaults = JSON.parse(String(user.order_defaults_json || "{}"));
  } catch (_error) {
    return;
  }

  let address;
  try {
    address = cleanAddressInput({
      label: "Default delivery address",
      street: defaults.street,
      suburb: defaults.suburb,
      postcode: defaults.postcode,
      isDefault: true,
    });
  } catch (_error) {
    return;
  }

  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO account_addresses (
       account_id, label, address_line_1, suburb, state, postcode,
       formatted_address, is_default, active,
       created_by_user_id, updated_by_user_id, created_at, updated_at
     ) VALUES (?, ?, ?, ?, 'VIC', ?, ?, 1, 1, ?, ?, ?, ?)`,
  ).bind(
    accountId,
    address.label,
    address.street,
    address.suburb,
    address.postcode,
    address.formattedAddress,
    Number(auth.userId),
    Number(auth.userId),
    now,
    now,
  ).run();
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
    throw forbidden("Only the account supervisor can manage saved addresses.");
  }
}

async function clearDefault(db, accountId, now, userId) {
  await db.prepare(
    `UPDATE account_addresses
     SET is_default = 0, updated_by_user_id = ?, updated_at = ?
     WHERE account_id = ? AND active = 1 AND is_default = 1`,
  ).bind(Number(userId), now, Number(accountId)).run();
}

async function assertNotDuplicate(db, accountId, address, excludeId = 0) {
  const duplicate = await db.prepare(
    `SELECT id FROM account_addresses
     WHERE account_id = ? AND active = 1
       AND address_line_1 = ? COLLATE NOCASE
       AND suburb = ? COLLATE NOCASE
       AND postcode = ?
       AND id <> ?
     LIMIT 1`,
  ).bind(accountId, address.street, address.suburb, address.postcode, Number(excludeId || 0)).first();
  if (duplicate?.id) throw conflict("That saved address already exists.");
}

async function readBody(context) {
  const body = await context.request.json().catch(() => null);
  if (!body || typeof body !== "object") throw badRequest("Invalid saved address request.");
  return body;
}

function cleanText(value, maxLength) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function toAddress(row) {
  return {
    id: Number(row.id),
    label: String(row.label || "").trim(),
    street: String(row.address_line_1 || "").trim(),
    suburb: String(row.suburb || "").trim(),
    state: String(row.state || "VIC").trim() || "VIC",
    postcode: String(row.postcode || "").trim(),
    formattedAddress: String(row.formatted_address || "").trim(),
    isDefault: Number(row.is_default || 0) === 1,
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

function requireAuth(context) {
  if (!context.env.DB) throw new Error("Missing Cloudflare binding: DB");
  const auth = context.data?.auth;
  if (!auth?.userId) throw Object.assign(new Error("Authentication required."), { status: 401 });
  return auth;
}

function badRequest(message) { return Object.assign(new Error(message), { status: 400 }); }
function forbidden(message) { return Object.assign(new Error(message), { status: 403 }); }
function notFound(message) { return Object.assign(new Error(message), { status: 404 }); }
function conflict(message) { return Object.assign(new Error(message), { status: 409 }); }
function fail(error) { return json({ ok: false, error: error?.message || String(error) }, Number(error?.status || 500)); }
