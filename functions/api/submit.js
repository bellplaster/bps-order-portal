import {
  appsScriptUrl,
  json,
  readJsonResponse,
  requireEnvironment,
  safeExcerpt,
} from "../_shared/responses.js";

const MAX_BODY_BYTES = 200_000;

export async function onRequestPost(context) {
  const requestId = crypto.randomUUID();

  try {
    requireEnvironment(
      context.env,
      [
        "APPS_SCRIPT_URL",
        "BRUNSWICK_WEBHOOK_KEY",
      ],
    );

    const contentLength = Number(
      context.request.headers.get("Content-Length") || 0,
    );

    if (contentLength > MAX_BODY_BYTES) {
      return json(
        {
          ok: false,
          error: "The submission exceeds the 200 KB request limit.",
          requestId,
        },
        413,
        {
          "X-Request-ID": requestId,
        },
      );
    }

    const payload = await context.request.json().catch(() => null);

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return json(
        {
          ok: false,
          error: "The portal submitted invalid JSON.",
          requestId,
        },
        400,
        {
          "X-Request-ID": requestId,
        },
      );
    }

    payload.key = String(context.env.BRUNSWICK_WEBHOOK_KEY);

    const endpoint = appsScriptUrl(
      context.env.APPS_SCRIPT_URL,
      context.env.BRUNSWICK_WEBHOOK_KEY,
    );

    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Portal-Request-ID": requestId,
      },
      body: JSON.stringify(payload),
      redirect: "follow",
    });

    const result = await readJsonResponse(upstream);

    if (upstream.ok && result.json?.ok) {
      return json(
        {
          ...result.json,
          requestId,
        },
        200,
        {
          "X-Request-ID": requestId,
        },
      );
    }

    const diagnostic = await fetchDiagnostic(context.env).catch(() => null);

    return json(
      {
        ok: false,
        error:
          result.json?.error ||
          result.json?.message ||
          diagnostic?.lastError?.message ||
          `Apps Script order generation failed with HTTP ${upstream.status}.`,
        diagnostic,
        upstreamResponse: result.json ? undefined : safeExcerpt(result.text),
        requestId,
      },
      502,
      {
        "X-Request-ID": requestId,
      },
    );
  } catch (error) {
    const diagnostic = await fetchDiagnostic(context.env).catch(() => null);

    return json(
      {
        ok: false,
        error: error?.message || String(error),
        diagnostic,
        requestId,
      },
      500,
      {
        "X-Request-ID": requestId,
      },
    );
  }
}

async function fetchDiagnostic(env) {
  if (!env.APPS_SCRIPT_URL || !env.BRUNSWICK_WEBHOOK_KEY) {
    return null;
  }

  const endpoint = appsScriptUrl(
    env.APPS_SCRIPT_URL,
    env.BRUNSWICK_WEBHOOK_KEY,
  );

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    redirect: "follow",
  });

  const result = await readJsonResponse(response);

  return result.json;
}
