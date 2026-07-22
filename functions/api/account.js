import { hashPassword, verifyPassword } from "../_shared/auth.js";
import { json } from "../_shared/responses.js";

export async function onRequestGet(context) {
  try {
    const auth = requireAuth(context);
    const profile = await getProfile(context.env.DB, auth);
    const response = { ok: true, profile };

    if (auth.role === "admin") {
      const [accounts, users] = await Promise.all([
        context.env.DB.prepare(
          `SELECT id, debtor_code, company_name, default_contact_name, default_mobile, active, created_at, updated_at
           FROM customer_accounts ORDER BY company_name COLLATE NOCASE`,
        ).all(),
        context.env.DB.prepare(
          `SELECT u.id, u.account_id, u.username, u.role, u.active, u.last_login_at,
                  a.company_name, a.debtor_code
           FROM users u
           LEFT JOIN customer_accounts a ON a.id = u.account_id
           ORDER BY u.username COLLATE NOCASE`,
        ).all(),
      ]);
      response.accounts = accounts.results || [];
      response.users = users.results || [];
    }

    return json(response, 200);
  } catch (error) {
    return apiError(error);
  }
}

export async function onRequestPut(context) {
  try {
    const auth = requireAuth(context);
    const body = await context.request.json().catch(() => null);
    if (!body || typeof body !== "object") throw badRequest("Invalid account request.");

    const targetAccountId = auth.role === "admin"
      ? Number(body.accountId || auth.accountId || 0)
      : Number(auth.accountId || 0);
    if (!targetAccountId) throw badRequest("Customer account not found.");

    const account = await context.env.DB.prepare(
      `SELECT * FROM customer_accounts WHERE id = ? LIMIT 1`,
    ).bind(targetAccountId).first();
    if (!account) throw notFound("Customer account not found.");

    const companyName = cleanRequired(body.companyName ?? account.company_name, "Company name", 160);
    const defaultContactName = cleanOptional(body.defaultContactName ?? account.default_contact_name, 100);
    const defaultMobile = normaliseMobile(body.defaultMobile ?? account.default_mobile, true);
    const debtorCode = auth.role === "admin"
      ? cleanRequired(body.debtorCode ?? account.debtor_code, "Debtor code", 80).toUpperCase()
      : account.debtor_code;
    const active = auth.role === "admin" && typeof body.active === "boolean"
      ? Number(body.active)
      : Number(account.active);

    await context.env.DB.prepare(
      `UPDATE customer_accounts
       SET debtor_code = ?, company_name = ?, default_contact_name = ?, default_mobile = ?, active = ?, updated_at = ?
       WHERE id = ?`,
    ).bind(debtorCode, companyName, defaultContactName, defaultMobile, active, nowIso(), targetAccountId).run();

    return json({ ok: true, profile: await getProfile(context.env.DB, { ...auth, accountId: targetAccountId }) });
  } catch (error) {
    return apiError(error);
  }
}

export async function onRequestPost(context) {
  try {
    const auth = requireAuth(context);
    const body = await context.request.json().catch(() => null);
    if (!body || typeof body !== "object") throw badRequest("Invalid account request.");
    const action = String(body.action || "").trim().toLowerCase();

    if (action === "change_password") {
      const user = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ? LIMIT 1`).bind(auth.userId).first();
      if (!user || !await verifyPassword(String(body.currentPassword || ""), user.password_salt, user.password_hash, user.password_iterations)) {
        throw forbidden("Current password is incorrect.");
      }
      await setPassword(context.env.DB, user.id, body.newPassword);
      return json({ ok: true });
    }

    if (auth.role !== "admin") throw forbidden("Administrator access required.");

    if (action === "create_account") {
      const debtorCode = cleanRequired(body.debtorCode, "Debtor code", 80).toUpperCase();
      const companyName = cleanRequired(body.companyName, "Company name", 160);
      const contact = cleanOptional(body.defaultContactName, 100);
      const mobile = normaliseMobile(body.defaultMobile, true);
      const result = await context.env.DB.prepare(
        `INSERT INTO customer_accounts (
           debtor_code, company_name, default_contact_name, default_mobile, active, created_at, updated_at
         ) VALUES (?, ?, ?, ?, 1, ?, ?)`,
      ).bind(debtorCode, companyName, contact, mobile, nowIso(), nowIso()).run();
      return json({ ok: true, accountId: Number(result?.meta?.last_row_id || 0) }, 201);
    }

    if (action === "create_user") {
      const username = normaliseUsername(body.username);
      const role = body.role === "admin" ? "admin" : "customer";
      const accountId = role === "admin" ? null : Number(body.accountId || 0);
      if (role === "customer" && !accountId) throw badRequest("Choose a customer account.");
      const passwordRecord = await hashPassword(String(body.password || ""));
      const result = await context.env.DB.prepare(
        `INSERT INTO users (
           account_id, username, password_hash, password_salt, password_iterations,
           role, active, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      ).bind(
        accountId,
        username,
        passwordRecord.hash,
        passwordRecord.salt,
        passwordRecord.iterations,
        role,
        nowIso(),
        nowIso(),
      ).run();
      return json({ ok: true, userId: Number(result?.meta?.last_row_id || 0) }, 201);
    }

    if (action === "reset_password") {
      const userId = Number(body.userId || 0);
      if (!userId) throw badRequest("Choose a user.");
      await setPassword(context.env.DB, userId, body.newPassword);
      return json({ ok: true });
    }

    if (action === "set_user_active") {
      const userId = Number(body.userId || 0);
      if (!userId) throw badRequest("Choose a user.");
      await context.env.DB.prepare(
        `UPDATE users SET active = ?, updated_at = ? WHERE id = ?`,
      ).bind(body.active === false ? 0 : 1, nowIso(), userId).run();
      return json({ ok: true });
    }

    throw badRequest("Unknown account action.");
  } catch (error) {
    return apiError(error);
  }
}

async function getProfile(db, auth) {
  const user = await db.prepare(
    `SELECT u.id, u.username, u.role, u.active, u.account_id,
            a.debtor_code, a.company_name, a.default_contact_name, a.default_mobile, a.active AS account_active
     FROM users u
     LEFT JOIN customer_accounts a ON a.id = u.account_id
     WHERE u.id = ? LIMIT 1`,
  ).bind(auth.userId).first();
  if (!user) throw forbidden("User account not found.");
  return {
    userId: user.id,
    username: user.username,
    role: user.role,
    accountId: user.account_id || null,
    debtorCode: user.debtor_code || "",
    companyName: user.company_name || "Bell Plaster Administration",
    defaultContactName: user.default_contact_name || "",
    defaultMobile: user.default_mobile || "",
    active: user.role === "admin" ? true : user.account_active === 1,
  };
}

async function setPassword(db, userId, password) {
  const record = await hashPassword(String(password || ""));
  await db.prepare(
    `UPDATE users SET password_hash = ?, password_salt = ?, password_iterations = ?, updated_at = ? WHERE id = ?`,
  ).bind(record.hash, record.salt, record.iterations, nowIso(), userId).run();
}

function requireAuth(context) {
  if (!context.env.DB) throw new Error("Missing Cloudflare binding: DB");
  const auth = context.data?.auth;
  if (!auth?.userId) throw forbidden("Authentication required.");
  return auth;
}

function normaliseUsername(value) {
  const username = String(value || "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,60}$/.test(username)) throw badRequest("Username must use 3–60 letters, numbers, dots, dashes or underscores.");
  return username;
}

function cleanRequired(value, label, maxLength) {
  const text = cleanOptional(value, maxLength);
  if (!text) throw badRequest(`${label} is required.`);
  return text;
}
function cleanOptional(value, maxLength) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}
function normaliseMobile(value, optional = false) {
  let digits = String(value || "").replace(/\D/g, "");
  if (!digits && optional) return "";
  if (digits.startsWith("61") && digits.length === 11) digits = `0${digits.slice(2)}`;
  if (!/^04\d{8}$/.test(digits)) throw badRequest("Mobile must be an Australian mobile number beginning with 04.");
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
}
function nowIso() { return new Date().toISOString(); }
function apiError(error) {
  return json({ ok: false, error: error?.message || String(error) }, Number(error?.status || 500));
}
function withStatus(message, status) { const error = new Error(message); error.status = status; return error; }
function badRequest(message) { return withStatus(message, 400); }
function forbidden(message) { return withStatus(message, 403); }
function notFound(message) { return withStatus(message, 404); }
