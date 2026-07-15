import {
  createSessionToken,
  passwordsMatch,
  sessionCookie,
} from "../_shared/auth.js";

import {
  json,
  requireEnvironment,
} from "../_shared/responses.js";

export async function onRequestPost(context) {
  try {
    requireEnvironment(
      context.env,
      [
        "PORTAL_PASSWORD",
        "SESSION_SECRET",
      ],
    );

    const body = await context.request.json().catch(() => null);
    const suppliedPassword = String(body?.password || "");

    const valid = await passwordsMatch(
      String(context.env.PORTAL_PASSWORD),
      suppliedPassword,
    );

    if (!valid) {
      return json(
        {
          ok: false,
          error: "Incorrect password.",
        },
        401,
      );
    }

    const token = await createSessionToken(
      String(context.env.SESSION_SECRET),
    );

    return json(
      {
        ok: true,
      },
      200,
      {
        "Set-Cookie": sessionCookie(token),
      },
    );
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
