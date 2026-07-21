export async function onRequestGet(context) {
  const apiKey = String(
    context.env.GOOGLE_MAPS_BROWSER_KEY || "",
  ).trim();

  return new Response(
    JSON.stringify({
      ok: true,
      configured: Boolean(apiKey),
      apiKey: apiKey || null,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
