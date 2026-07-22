import {
  createSessionToken,
  hashPassword,
  passwordsMatch,
  sessionCookie,
  verifyPassword,
} from "../_shared/auth.js";

import { json, requireEnvironment } from "../_shared/responses.js";
import {
  ensurePortalSchema,
  getOrCreateSessionSecret,
} from "../_shared/setup.js";

export async function onRequestPost(context) {
  try {
    requireEnvironment(context.env, ["PORTAL_PASSWORD"]);
    if (!context.env.DB) throw new Error("Missing Cloudflare binding: DB");

    await ensurePortalSchema(context.env.DB);
    const sessionSecret = await getOrCreateSessionSecret(context.env);

    const body = await context.request.json().catch(() => null);
    const username = String(body?.username || "").trim().toLowerCase();
    const password = String(body?.password || "");

    if (!/^[a-z0-9._-]{3,60}$/.test(username)) {
      return json({ ok: false, error: "Enter a valid username." }, 400);
    }

    let user = await findUser(context.env.DB, username);

    if (!user && ["admin", "bps"].includes(username)) {
      const validBootstrapPassword = await passwordsMatch(String(context.env.PORTAL_PASSWORD), password);
      if (validBootstrapPassword) {
        user = await bootstrapUser(context.env.DB, username, password);
      }
    }

    const valid = user && user.active === 1 && await verifyPassword(
      password,
      user.password_salt,
      user.password_hash,
      user.password_iterations,
    );

    if (!valid) return json({ ok: false, error: "Incorrect username or password." }, 401);
    if (user.role !== "admin" && (!user.account_id || user.account_active !== 1)) {
      return json({ ok: false, error: "This customer account is inactive." }, 403);
    }

    const now = nowIso();
    await context.env.DB.prepare(
      `UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?`,
    ).bind(now, now, user.id).run();

    const token = await createSessionToken(sessionSecret, {
      userId: user.id,
      accountId: user.account_id,
      username: user.username,
      role: user.role,
    });

    return json(
      {
        ok: true,
        user: {
          username: user.username,
          role: user.role,
          accountId: user.account_id || null,
          companyName: user.company_name || "Bell Plaster Administration",
        },
      },
      200,
      { "Set-Cookie": sessionCookie(token) },
    );
  } catch (error) {
    return json({ ok: false, error: error?.message || String(error) }, 500);
  }
}

async function findUser(db, username) {
  return db.prepare(
    `SELECT
       u.id,
       u.account_id,
       u.username,
       u.password_hash,
       u.password_salt,
       u.password_iterations,
       u.role,
       u.active,
       a.debtor_code,
       a.company_name,
       a.active AS account_active
     FROM users u
     LEFT JOIN customer_accounts a ON a.id = u.account_id
     WHERE u.username = ? COLLATE NOCASE
     LIMIT 1`,
  ).bind(username).first();
}

async function bootstrapUser(db, username, password) {
  const now = nowIso();
  let accountId = null;
  let role = "admin";

  if (username === "bps") {
    role = "customer";
    const account = await db.prepare(
      `SELECT id FROM customer_accounts WHERE debtor_code = 'BPS BRUNSW17' LIMIT 1`,
    ).first();
    if (!account?.id) throw new Error("The BPS customer account could not be initialized.");
    accountId = Number(account.id);
  }

  const passwordRecord = await hashPassword(password);
  await db.prepare(
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
    now,
    now,
  ).run();

  return findUser(db, username);
}

function nowIso() {
  return new Date().toISOString();
}
