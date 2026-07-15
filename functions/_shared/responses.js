export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

export function requireEnvironment(env, names) {
  const missing = names.filter((name) => !String(env[name] || "").trim());

  if (missing.length > 0) {
    throw new Error(
      `Missing Cloudflare secret${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}`,
    );
  }
}

export async function readJsonResponse(response) {
  const text = await response.text();

  try {
    return {
      json: JSON.parse(text),
      text,
    };
  } catch (_error) {
    return {
      json: null,
      text,
    };
  }
}

export function appsScriptUrl(baseUrl, key, action = "") {
  const url = new URL(String(baseUrl).trim());
  url.searchParams.set("key", key);

  if (action) {
    url.searchParams.set("action", action);
  }

  return url.toString();
}

export function safeExcerpt(value, maxLength = 500) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}
