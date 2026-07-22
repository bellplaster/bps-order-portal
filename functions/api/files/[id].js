export async function onRequestGet(context) {
  const fileId = Number(context.params.id);
  if (!Number.isInteger(fileId) || fileId <= 0) {
    return Response.json({ ok: false, error: "Invalid file ID." }, { status: 400 });
  }
  if (!context.env.DB || !context.env.ORDER_FILES) {
    return Response.json({ ok: false, error: "Required Cloudflare bindings are missing." }, { status: 500 });
  }
  const auth = context.data?.auth;
  if (!auth?.userId) return Response.json({ ok: false, error: "Authentication required." }, { status: 401 });

  const file = await context.env.DB.prepare(
    `SELECT f.filename, f.r2_key, o.account_id
     FROM order_files f
     INNER JOIN orders o ON o.submission_id = f.submission_id
     WHERE f.id = ? LIMIT 1`,
  ).bind(fileId).first();
  if (!file || (auth.role !== "admin" && Number(file.account_id || 0) !== Number(auth.accountId || 0))) {
    return Response.json({ ok: false, error: "File record not found." }, { status: 404 });
  }

  const object = await context.env.ORDER_FILES.get(file.r2_key);
  if (!object) return Response.json({ ok: false, error: "The XLSX file is missing from R2." }, { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
  headers.set("Cache-Control", "private, no-store");
  headers.set("ETag", object.httpEtag);
  return new Response(object.body, { headers });
}
