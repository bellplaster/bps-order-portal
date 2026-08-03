import { canViewOrder, getOrderScope } from "../../_shared/order-permissions.js";

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

  await ensureOrderTrackingSchema(context.env.DB);
  const viewer = await context.env.DB.prepare(
    `SELECT id, account_id, role, active, is_primary FROM users WHERE id = ? AND active = 1 LIMIT 1`,
  ).bind(auth.userId).first();
  if (!viewer || (getOrderScope(viewer) !== "all" && !Number(viewer.account_id || 0))) {
    return Response.json({ ok: false, error: "File record not found." }, { status: 404 });
  }

  const file = await context.env.DB.prepare(
    `SELECT f.filename, f.r2_key, o.account_id, o.created_by_user_id
     FROM order_files f
     INNER JOIN orders o ON o.submission_id = f.submission_id
     WHERE f.id = ? LIMIT 1`,
  ).bind(fileId).first();

  if (!file || !canViewOrder(viewer, file)) {
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

async function ensureOrderTrackingSchema(db) {
  const columns = await db.prepare(`PRAGMA table_info(orders)`).all();
  const names = new Set((columns.results || []).map((row) => String(row.name)));
  const additions = {
    created_by_user_id: "INTEGER",
    created_by_username_snapshot: "TEXT NOT NULL DEFAULT ''",
    created_by_name_snapshot: "TEXT NOT NULL DEFAULT ''",
  };
  for (const [name, definition] of Object.entries(additions)) {
    if (!names.has(name)) await db.prepare(`ALTER TABLE orders ADD COLUMN ${name} ${definition}`).run();
  }
}
