import {
  SESSION_COOKIE,
  readCookie,
  verifySessionToken,
} from "./_shared/auth.js";

import { json } from "./_shared/responses.js";

const PUBLIC_PATHS = new Set([
  "/signin",
  "/signin/",
  "/login.js",
  "/styles.css",
  "/refinement.css",
  "/api/login",
]);

export async function onRequest(context) {
  const url = new URL(context.request.url);

  try {
    if (PUBLIC_PATHS.has(url.pathname)) return context.next();

    const sessionSecret = String(context.env.SESSION_SECRET || "");
    if (!sessionSecret) {
      return json({ ok: false, error: "SESSION_SECRET is not configured in Cloudflare." }, 500);
    }

    const token = readCookie(context.request, SESSION_COOKIE);
    const session = await verifySessionToken(sessionSecret, token);

    if (!session) {
      if (url.pathname.startsWith("/api/")) {
        return json({ ok: false, error: "Authentication required." }, 401);
      }
      return Response.redirect(new URL("/signin/", url), 302);
    }

    context.data.auth = session;
    return context.next();
  } catch (error) {
    return json({ ok: false, error: error?.message || String(error) }, 500);
  }
}
