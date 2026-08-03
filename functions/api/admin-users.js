import { hashPassword } from "../_shared/auth.js";
import { normaliseAustralianPhone } from "../_shared/phone.js";
import { json } from "../_shared/responses.js";
import {
  isAdministratorRole,
  parseUserRole,
  roleRequiresCustomerAccount,
  USER_ROLES,
} from "../_shared/user-roles.js";
import { ensureUserRoleSchema } from "../_shared/user-schema.js";

export async function onRequestGet(context) {
  try {
    const auth = requireAdmin(context);
    await ensureSchema(context.env.DB);
    const [accounts, users] = await Promise.all([
      context.env.DB.prepare(`SELECT id, debtor_code, company_name, active FROM customer_accounts ORDER BY company_name COLLATE NOCASE`).all(),
      context.env.DB.prepare(`SELECT u.id, u.account_id, u.username, u.role, u.active, u.is_primary,
                                    u.default_contact_name, u.default_mobile, u.last_login_at,
                                    a.company_name, a.debtor_code
                             FROM users u
                             LEFT JOIN customer_accounts a ON a.id = u.account_id
                             ORDER BY CASE u.role
                                        WHEN 'admin' THEN 0
                                        WHEN 'customer_service' THEN 1
                                        ELSE 2
                                      END,
                                      COALESCE(a.company_name, '') COLLATE NOCASE,
                                      u.is_primary DESC,
                                      u.username COLLATE NOCASE`).all(),
    ]);
    return json({
      ok: true,
      currentUserId: Number(auth.userId),
      accounts: accounts.results || [],
      users: users.results || [],
    });
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

    if (action === "create") return createUser(context.env.DB, body);

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
    await assertUniqueUsername(context.env.DB, username, userId);

    const role = requireSupportedRole(body.role ?? existing.role);
    if (userId === Number(auth.userId) && isAdministratorRole(existing.role) && role !== USER_ROLES.ADMIN) {
      throw badRequest("You cannot remove your own administrator access.");
    }

    const accountId = role === USER_ROLES.CUSTOMER
      ? Number(body.accountId || existing.account_id || 0)
      : role === USER_ROLES.ADMIN && isAdministratorRole(existing.role)
        ? (Number(existing.account_id || 0) || null)
        : null;
    if (roleRequiresCustomerAccount(role)) await assertCustomerAccount(context.env.DB, accountId, false);

    const contactName = cleanOptional(body.contactName, 100);
    const mobile = normaliseAustralianPhone(body.mobile, {
      optional: true,
      error: "Enter a valid Australian phone number.",
    });
    const active = body.active === false ? 0 : 1;
    if (userId === Number(auth.userId) && isAdministratorRole(existing.role) && !active) {
      throw badRequest("You cannot deactivate your own administrator account.");
    }
    const primary = role === USER_ROLES.CUSTOMER && active === 1 && body.primary === true ? 1 : 0;
    const now = new Date().toISOString();

    if (primary) await clearPrimary(context.env.DB, accountId, now);

    await context.env.DB.prepare(`UPDATE users
                                  SET username = ?, role = ?, account_id = ?,
                                      default_contact_name = ?, default_mobile = ?,
                                      active = ?, is_primary = ?, updated_at = ?
                                  WHERE id = ?`)
      .bind(username, role, accountId, contactName, mobile, active, primary, now, userId).run();

    const newPassword = String(body.newPassword || "");
    if (newPassword) await updatePassword(context.env.DB, userId, newPassword, now);

    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}

async function createUser(db, body) {
  const username = normaliseUsername(body.username);
  await assertUniqueUsername(db, username, 0);

  const role = requireSupportedRole(body.role);
  const accountId = roleRequiresCustomerAccount(role) ? Number(body.accountId || 0) : null;
  if (roleRequiresCustomerAccount(role)) await assertCustomerAccount(db, accountId, true);

  const passwordValue = String(body.password || "");
  if (passwordValue.length < 8) throw badRequest("Password must contain at least 8 characters.");
  const password = await hashPassword(passwordValue);
  const contactName = cleanOptional(body.contactName, 100);
  const mobile = normaliseAustralianPhone(body.mobile, {
    optional: true,
    error: "Enter a valid Australian phone number.",
  });
  const primary = role === USER_ROLES.CUSTOMER && body.primary === true ? 1 : 0;
  const now = new Date().toISOString();

  if (primary) await clearPrimary(db, accountId, now);

  const result = await db.prepare(`INSERT INTO users (
      account_id, username, password_hash, password_salt, password_iterations,
      role, active, is_primary, default_contact_name, default_mobile,
      order_defaults_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, '{}', ?, ?)`)
    .bind(
      accountId,
      username,
      password.hash,
      password.salt,
      password.iterations,
      role,
      primary,
      contactName,
      mobile,
      now,
      now,
    ).run();

  return json({ ok: true, userId: Number(result?.meta?.last_row_id || 0) }, 201);
}

async function assertUniqueUsername(db, username, excludedUserId) {
  const duplicate = excludedUserId
    ? await db.prepare(`SELECT id FROM users WHERE username = ? COLLATE NOCASE AND id <> ? LIMIT 1`).bind(username, excludedUserId).first()
    : await db.prepare(`SELECT id FROM users WHERE username = ? COLLATE NOCASE LIMIT 1`).bind(username).first();
  if (duplicate) throw conflict("That username is already in use.");
}

async function assertCustomerAccount(db, accountId, requireActive) {
  if (!accountId) throw badRequest("Choose a customer account.");
  const account = await db.prepare(`SELECT id, active FROM customer_accounts WHERE id = ? LIMIT 1`).bind(accountId).first();
  if (!account) throw badRequest("Customer account not found.");
  if (requireActive && Number(account.active) !== 1) throw badRequest("Choose an active customer account.");
}

async function clearPrimary(db, accountId, now) {
  await db.prepare(`UPDATE users SET is_primary = 0, updated_at = ? WHERE account_id = ? AND role = 'customer'`)
    .bind(now, accountId).run();
}

async function updatePassword(db, userId, value, now) {
  if (value.length < 8) throw badRequest("Password must contain at least 8 characters.");
  const password = await hashPassword(value);
  await db.prepare(`UPDATE users
                    SET password_hash = ?, password_salt = ?, password_iterations = ?, updated_at = ?
                    WHERE id = ?`)
    .bind(password.hash, password.salt, password.iterations, now, userId).run();
}

function requireAdmin(context) {
  const auth = context.data?.auth;
  if (!auth?.userId) throw Object.assign(new Error("Authentication required."), { status: 401 });
  if (!isAdministratorRole(auth.role)) throw Object.assign(new Error("Administrator access required."), { status: 403 });
  return auth;
}

async function ensureSchema(db) {
  await ensureUserRoleSchema(db);
}

function requireSupportedRole(value) {
  const role = parseUserRole(value);
  if (!role) throw badRequest("Choose a valid portal role.");
  return role;
}

function normaliseUsername(value) {
  const username = String(value || "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,80}$/.test(username)) {
    throw badRequest("Username must be 3–80 characters using letters, numbers, dots, underscores or dashes.");
  }
  return username;
}

function cleanOptional(value, max) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}
function badRequest(message) { return Object.assign(new Error(message), { status: 400 }); }
function notFound(message) { return Object.assign(new Error(message), { status: 404 }); }
function conflict(message) { return Object.assign(new Error(message), { status: 409 }); }
function fail(error) { return json({ ok: false, error: error?.message || String(error) }, Number(error?.status || 500)); }
