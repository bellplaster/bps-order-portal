import { hashPassword } from "../_shared/auth.js";
import { normaliseAustralianPhone } from "../_shared/phone.js";
import { json } from "../_shared/responses.js";

export async function onRequestGet(context) {
  try {
    requireAdmin(context);
    await ensureSchema(context.env.DB);
    const [accounts, users] = await Promise.all([
      context.env.DB.prepare(`SELECT id, debtor_code, company_name, active FROM customer_accounts ORDER BY company_name COLLATE NOCASE`).all(),
      context.env.DB.prepare(`SELECT u.id, u.account_id, u.username, u.role, u.active, u.is_primary,
                                    u.default_contact_name, u.default_mobile, u.last_login_at,
                                    a.company_name, a.debtor_code
                             FROM users u
                             LEFT JOIN customer_accounts a ON a.id = u.account_id
                             ORDER BY COALESCE(a.company_name, 'Bell Plaster') COLLATE NOCASE, u.username COLLATE NOCASE`).all(),
    ]);
    return json({ ok: true, accounts: accounts.results || [], users: users.results || [] });
  } catch (error) {
    return fail(error);
  }
}

export async function onRequestPost(context) {
  try {
    const auth = requireAdmin(context);
    await ensureSchema(context.env.DB);
    const body = await context.request.json().catch(() => null);
    if (!body || typeof body !== "object") throw badRequest("Invalid portal user request.");
    const action = String(body.action || "").trim().toLowerCase();
    const userId = Number(body.userId || 0);
    if (!userId) throw badRequest("Choose a portal user.");

    const existing = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ? LIMIT 1`).bind(userId).first();
    if (!existing) throw notFound("Portal user not found.");

    if (action === "delete") {
      if (userId === Number(auth.userId)) throw badRequest("You cannot delete your own administrator account.");
      await context.env.DB.prepare(`DELETE FROM users WHERE id = ?`).bind(userId).run();
      return json({ ok: true });
    }

    if (action !== "update") throw badRequest("Unknown portal user action.");

    const username = normaliseUsername(body.username ?? existing.username);
    const duplicate = await context.env.DB.prepare(`SELECT id FROM users WHERE username = ? COLLATE NOCASE AND id <> ? LIMIT 1`).bind(username, userId).first();
    if (duplicate) throw conflict("That username is already in use.");

    const role = existing.role === "admin" ? "admin" : "customer";
    const accountId = role === "admin" ? null : Number(body.accountId || existing.account_id || 0);
    if (role === "customer" && !accountId) throw badRequest("Choose a customer account.");
    if (role === "customer") {
      const account = await context.env.DB.prepare(`SELECT id FROM customer_accounts WHERE id = ? LIMIT 1`).bind(accountId).first();
      if (!account) throw badRequest("Customer account not found.");
    }

    const contactName = cleanOptional(body.contactName, 100);
    const mobile = normaliseAustralianPhone(body.mobile, { optional: true, error: "Enter a valid Australian phone number." });
    const active = body.active === false ? 0 : 1;
    const primary = role === "customer" && body.primary === true ? 1 : 0;
    const now = new Date().toISOString();

    if (primary) {
      await context.env.DB.prepare(`UPDATE users SET is_primary = 0, updated_at = ? WHERE account_id = ? AND role = 'customer'`).bind(now, accountId).run();
    }

    await context.env.DB.prepare(`UPDATE users
                                  SET username = ?, account_id = ?, default_contact_name = ?, default_mobile = ?,
                                      active = ?, is_primary = ?, updated_at = ?
                                  WHERE id = ?`).bind(username, accountId, contactName, mobile, active, primary, now, userId).run();

    const newPassword = String(body.newPassword || "");
    if (newPassword) {
      const password = await hashPassword(newPassword);
      await context.env.DB.prepare(`UPDATE users SET password_hash = ?, password_salt = ?, password_iterations = ?, updated_at = ? WHERE id = ?`)
        .bind(password.hash, password.salt, password.iterations, now, userId).run();
    }

    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}

function requireAdmin(context) {
  const auth = context.data?.auth;
  if (!auth?.userId) throw Object.assign(new Error("Authentication required."), { status: 401 });
  if (auth.role !== "admin") throw Object.assign(new Error("Administrator access required."), { status: 403 });
  return auth;
}

async function ensureSchema(db) {
  const columns = await db.prepare(`PRAGMA table_info(users)`).all();
  const names = new Set((columns.results || []).map((row) => String(row.name)));
  if (!names.has("is_primary")) await db.prepare(`ALTER TABLE users ADD COLUMN is_primary INTEGER NOT NULL DEFAULT 0`).run();
  await db.prepare(`UPDATE users SET is_primary = 0 WHERE role <> 'customer' OR account_id IS NULL`).run();
}

function normaliseUsername(value) {
  const username = String(value || "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,80}$/.test(username)) throw badRequest("Username must be 3–80 characters using letters, numbers, dots, underscores or dashes.");
  return username;
}
function cleanOptional(value, max) { return String(value || "").trim().replace(/\s+/g, " ").slice(0, max); }
function badRequest(message) { return Object.assign(new Error(message), { status: 400 }); }
function notFound(message) { return Object.assign(new Error(message), { status: 404 }); }
function conflict(message) { return Object.assign(new Error(message), { status: 409 }); }
function fail(error) { return json({ ok: false, error: error?.message || String(error) }, Number(error?.status || 500)); }
