import {
  SESSION_COOKIE,
  readCookie,
  verifySessionToken,
} from "./_shared/auth.js";

import { json } from "./_shared/responses.js";
import { getOrCreateSessionSecret } from "./_shared/setup.js";
import { isCustomerServiceRole } from "./_shared/user-roles.js";

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

const CUSTOMER_SERVICE_REDIRECT_PATHS = new Set(["/account", "/account/"]);
const SESSION_TIMEOUT_SCRIPT = '<script src="/session-timeout.js?v=20260808-1" defer></script>';

export async function onRequest(context) {
  const url = new URL(context.request.url);

  try {
    if (PUBLIC_PATHS.has(url.pathname)) return context.next();

    const sessionSecret = await getOrCreateSessionSecret(context.env);
    const token = readCookie(context.request, SESSION_COOKIE);
    const session = await verifySessionToken(sessionSecret, token);

    if (!session) {
      if (url.pathname.startsWith("/api/")) {
        return json({ ok: false, error: "Authentication required." }, 401);
      }
      return Response.redirect(new URL("/signin/", url), 302);
    }

    if (isCustomerServiceRole(session.role) && CUSTOMER_SERVICE_REDIRECT_PATHS.has(url.pathname)) {
      return Response.redirect(new URL("/orders/", url), 302);
    }

    context.data.auth = session;
    const response = await context.next();
    return injectSessionTimeout(response);
  } catch (error) {
    return json({ ok: false, error: error?.message || String(error) }, 500);
  }
}

async function injectSessionTimeout(response) {
  const contentType = response.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().includes("text/html")) return response;

  const html = await response.text();
  if (html.includes("/session-timeout.js")) {
    return new Response(html, response);
  }

  const injected = html.includes("</body>")
    ? html.replace("</body>", `  ${SESSION_TIMEOUT_SCRIPT}\n</body>`)
    : `${html}\n${SESSION_TIMEOUT_SCRIPT}`;
  const headers = new Headers(response.headers);
  headers.delete("Content-Length");

  return new Response(injected, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
