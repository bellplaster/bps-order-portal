import { json } from "../_shared/responses.js";

export async function onRequestGet(context) {
  try {
    const auth = context.data?.auth;
    if (!auth?.userId) return json({ ok: false, error: "Authentication required." }, 401);

    const url = new URL(context.request.url);
    const includeAll = auth.role === "admin" && url.searchParams.get("all") === "1";
    const accountId = Number(auth.accountId || 0);

    let query;
    let bindings = [];
    if (includeAll) {
      query = `SELECT u.id, u.account_id, u.username, u.role, u.active,
                      u.default_contact_name, u.default_mobile,
                      a.company_name, a.debtor_code
               FROM users u
               LEFT JOIN customer_accounts a ON a.id = u.account_id
               ORDER BY COALESCE(a.company_name, 'Bell Plaster') COLLATE NOCASE,
                        u.username COLLATE NOCASE`;
    } else {
      if (!accountId) return json({ ok: true, contacts: [] });
      query = `SELECT u.id, u.account_id, u.username, u.role, u.active,
                      u.default_contact_name, u.default_mobile,
                      a.company_name, a.debtor_code
               FROM users u
               LEFT JOIN customer_accounts a ON a.id = u.account_id
               WHERE u.account_id = ? AND u.role = 'customer' AND u.active = 1
               ORDER BY CASE WHEN u.id = ? THEN 0 ELSE 1 END,
                        COALESCE(NULLIF(u.default_contact_name, ''), u.username) COLLATE NOCASE`;
      bindings = [accountId, Number(auth.userId)];
    }

    const statement = context.env.DB.prepare(query);
    const result = bindings.length ? await statement.bind(...bindings).all() : await statement.all();
    const contacts = (result.results || []).map((row) => ({
      id: Number(row.id),
      accountId: row.account_id == null ? null : Number(row.account_id),
      username: String(row.username || ""),
      role: String(row.role || "customer"),
      active: Number(row.active) === 1,
      contactName: String(row.default_contact_name || "").trim(),
      mobile: String(row.default_mobile || "").trim(),
      companyName: String(row.company_name || "Bell Plaster"),
      debtorCode: String(row.debtor_code || ""),
    }));

    return json({ ok: true, contacts });
  } catch (error) {
    return json({ ok: false, error: error?.message || String(error) }, 500);
  }
}
