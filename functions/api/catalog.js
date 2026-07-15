import {
  appsScriptUrl,
  json,
  readJsonResponse,
  requireEnvironment,
  safeExcerpt,
} from "../_shared/responses.js";

export async function onRequestGet(context) {
  const requestId = crypto.randomUUID();

  try {
    requireEnvironment(
      context.env,
      [
        "APPS_SCRIPT_URL",
        "BRUNSWICK_WEBHOOK_KEY",
      ],
    );

    const endpoint = appsScriptUrl(
      context.env.APPS_SCRIPT_URL,
      context.env.BRUNSWICK_WEBHOOK_KEY,
      "catalog",
    );

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      redirect: "follow",
    });

    const result = await readJsonResponse(response);

    if (!response.ok || !result.json?.ok) {
      return json(
        {
          ok: false,
          error:
            result.json?.error ||
            result.json?.message ||
            `Apps Script catalogue request failed with HTTP ${response.status}.`,
          upstreamResponse: result.json ? undefined : safeExcerpt(result.text),
          requestId,
        },
        502,
        {
          "X-Request-ID": requestId,
        },
      );
    }

    return json(
      {
        ...result.json,
        requestId,
      },
      200,
      {
        "X-Request-ID": requestId,
        "Cache-Control": "private, max-age=300",
      },
    );
  } catch (error) {
    return json(
      {
        ok: false,
        error: error?.message || String(error),
        requestId,
      },
      500,
      {
        "X-Request-ID": requestId,
      },
    );
  }
}
