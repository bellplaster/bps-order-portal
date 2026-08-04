import {
  SESSION_COOKIE,
  expiredSessionCookie,
  readCookie,
  verifySessionToken,
} from "./_shared/auth.js";

import { json } from "./_shared/responses.js";
import { getOrCreateSessionSecret } from "./_shared/setup.js";
import {
  isCustomerServiceRole,
  roleRequiresCustomerAccount,
} from "./_shared/user-roles.js";

const PUBLIC_PATHS = new Set([
  "/signin",
  "/signin/",
  "/login.js",
  "/styles.css",
  "/refinement.css",
  "/form-components.css",
  "/form-sections.css",
  "/responsive.css",
  "/api/login",
]);

const CUSTOMER_SERVICE_REDIRECT_PATHS = new Set(["/", "/account", "/account/"]);

export async function onRequest(context) {
  const url = new URL(context.request.url);

  try {
    if (PUBLIC_PATHS.has(url.pathname)) return context.next();

    const sessionSecret = await getOrCreateSessionSecret(context.env);
    const token = readCookie(context.request, SESSION_COOKIE);
    const session = await verifySessionToken(sessionSecret, token);

    if (!session) return rejectSession(url, "Authentication required.");

    const access = await getCurrentAccess(context.env.DB, session.userId);
    const accessDenied = !access
      || Number(access.user_active || 0) !== 1
      || (roleRequiresCustomerAccount(access.role)
        && (!access.account_id || Number(access.account_active || 0) !== 1));

    if (accessDenied) {
      const message = access && roleRequiresCustomerAccount(access.role)
        ? "This customer account is inactive."
        : "Authentication required.";
      return rejectSession(url, message);
    }

    const currentSession = {
      ...session,
      accountId: access.account_id || null,
      role: access.role,
    };

    if (isCustomerServiceRole(currentSession.role) && CUSTOMER_SERVICE_REDIRECT_PATHS.has(url.pathname)) {
      return Response.redirect(new URL("/orders/", url), 302);
    }

    context.data.auth = currentSession;
    return context.next();
  } catch (error) {
    return json({ ok: false, error: error?.message || String(error) }, 500);
  }
}

async function getCurrentAccess(db, userId) {
  if (!db || !userId) return null;
  return db.prepare(
    `SELECT u.id, u.account_id, u.active AS user_active,
            COALESCE(NULLIF(u.access_role, ''), u.role) AS role,
            a.active AS account_active
     FROM users u
     LEFT JOIN customer_accounts a ON a.id = u.account_id
     WHERE u.id = ?
     LIMIT 1`,
  ).bind(Number(userId)).first();
}

function rejectSession(url, message) {
  const headers = { "Set-Cookie": expiredSessionCookie() };
  if (url.pathname.startsWith("/api/")) {
    return json({ ok: false, error: message }, 401, headers);
  }
  return new Response(null, {
    status: 302,
    headers: {
      ...headers,
      Location: new URL("/signin/", url).toString(),
    },
  });
}
