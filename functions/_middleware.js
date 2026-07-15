import {
  SESSION_COOKIE,
  readCookie,
  verifySessionToken,
} from "./_shared/auth.js";

import {
  json,
} from "./_shared/responses.js";

/*
 * Use a directory-based sign-in page:
 * public/signin/index.html → /signin/
 *
 * This avoids Cloudflare Pages' automatic clean-URL handling for login.html,
 * which can otherwise create a redirect loop with authentication middleware.
 */
const PUBLIC_PATHS = new Set([
  "/signin",
  "/signin/",
  "/login.js",
  "/styles.css",
  "/api/login",
]);

export async function onRequest(context) {
  const url = new URL(context.request.url);

  try {
    if (PUBLIC_PATHS.has(url.pathname)) {
      return await context.next();
    }

    const sessionSecret = String(context.env.SESSION_SECRET || "");

    if (!sessionSecret) {
      return json(
        {
          ok: false,
          error: "SESSION_SECRET is not configured in Cloudflare.",
        },
        500,
      );
    }

    const token = readCookie(
      context.request,
      SESSION_COOKIE,
    );

    const authenticated = await verifySessionToken(
      sessionSecret,
      token,
    );

    if (!authenticated) {
      if (url.pathname.startsWith("/api/")) {
        return json(
          {
            ok: false,
            error: "Authentication required.",
          },
          401,
        );
      }

      return Response.redirect(
        new URL("/signin/", url),
        302,
      );
    }

    return await context.next();
  } catch (error) {
    return json(
      {
        ok: false,
        error: error?.message || String(error),
      },
      500,
    );
  }
}
