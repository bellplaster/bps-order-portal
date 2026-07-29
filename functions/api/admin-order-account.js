import { createSessionToken, sessionCookie } from "../_shared/auth.js";
import { json } from "../_shared/responses.js";
import { getOrCreateSessionSecret } from "../_shared/setup.js";

export async function onRequestPost(context) {
  try {
    const auth = context.data?.auth;
    if (!auth?.userId || auth.role !== "admin") {
      return json({ ok: false, error: "Administrator access required." }, 403);
    }

    const body = await context.request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json({ ok: false, error: "Invalid customer selection." }, 400);
    }

    const requestedAccountId = Number(body.accountId || 0);
    let account = null;

    if (requestedAccountId) {
      account = await context.env.DB.prepare(
        `SELECT id, debtor_code, company_name, active
         FROM customer_accounts
         WHERE id = ? AND active = 1
         LIMIT 1`,
      ).bind(requestedAccountId).first();

      if (!account) {
        return json({ ok: false, error: "Choose an active customer account." }, 400);
      }
    }

    await context.env.DB.prepare(
      `UPDATE users
       SET account_id = ?, updated_at = ?
       WHERE id = ? AND role = 'admin'`,
    ).bind(account?.id || null, new Date().toISOString(), auth.userId).run();

    const sessionSecret = await getOrCreateSessionSecret(context.env);
    const token = await createSessionToken(sessionSecret, {
      userId: auth.userId,
      accountId: account?.id || null,
      username: auth.username,
      role: "admin",
    });

    return json(
      {
        ok: true,
        account: account
          ? {
              id: Number(account.id),
              debtorCode: String(account.debtor_code || ""),
              companyName: String(account.company_name || ""),
            }
          : null,
      },
      200,
      { "Set-Cookie": sessionCookie(token) },
    );
  } catch (error) {
    return json({ ok: false, error: error?.message || String(error) }, 500);
  }
}
