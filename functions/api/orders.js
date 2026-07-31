import { PRODUCT_CATALOG } from "../_shared/catalog.js";

export async function onRequestGet(context) {
  const requestId = crypto.randomUUID();
  try {
    if (!context.env.DB) throw new Error("Missing Cloudflare binding: DB");
    const auth = context.data?.auth;
    if (!auth?.userId) return Response.json({ ok: false, error: "Authentication required.", requestId }, { status: 401 });

    await ensureOrderTrackingSchema(context.env.DB);
    const viewer = await context.env.DB.prepare(
      `SELECT id, account_id, username, role, active, is_primary, default_contact_name
       FROM users WHERE id = ? AND active = 1 LIMIT 1`,
    ).bind(auth.userId).first();
    const accountId = Number(viewer?.account_id || 0);
    if (!viewer || !accountId) {
      return Response.json({ ok: false, error: "Your login is not assigned to a customer account.", requestId }, { status: 400 });
    }

    const canViewAccountOrders = viewer.role === "admin" || Number(viewer.is_primary) === 1;
    const where = canViewAccountOrders
      ? "WHERE o.account_id = ?"
      : "WHERE o.account_id = ? AND o.created_by_user_id = ?";
    const sql = `SELECT
       o.submission_id, o.customer_reference, o.status, o.created_at, o.updated_at,
       o.payload_json, o.account_id, o.company_name_snapshot, o.debtor_code_snapshot,
       o.created_by_user_id, o.created_by_username_snapshot, o.created_by_name_snapshot
     FROM orders o ${where}
     ORDER BY o.created_at DESC LIMIT 200`;
    const query = context.env.DB.prepare(sql);
    const ordersResult = canViewAccountOrders
      ? await query.bind(accountId).all()
      : await query.bind(accountId, Number(viewer.id)).all();

    const orders = [];
    for (const order of ordersResult.results || []) {
      const filesResult = await context.env.DB.prepare(
        `SELECT id, floor, floor_label, filename, r2_key, item_count, created_at
         FROM order_files WHERE submission_id = ? ORDER BY id DESC`,
      ).bind(order.submission_id).all();
      const files = (filesResult.results || []).map((file) => ({
        ...file,
        revision: inferRevision(file.filename),
        download_url: `/api/files/${file.id}`,
      }));
      let payload = {};
      try { payload = JSON.parse(order.payload_json || "{}"); } catch (_error) { payload = {}; }
      const areaLabel = (floor, details) => details?.label || (floor === "first" ? "1st Floor" : floor === "ground" ? "Ground Floor" : floor);
      const otherProducts = Object.entries(payload?.floors || {}).map(([floor, details]) => ({
        floor,
        floor_label: areaLabel(floor, details),
        details: String(details?.otherProducts || "").trim(),
      })).filter((item) => item.details);
      const otherMaterials = Object.entries(payload?.floors || {}).map(([floor, details]) => ({
        floor,
        floor_label: areaLabel(floor, details),
        items: Array.isArray(details?.otherMaterials) ? details.otherMaterials : [],
      })).filter((item) => item.items.length);
      const pendingMapping = [];
      Object.entries(payload?.floors || {}).forEach(([floor, details]) => {
        const pendingItems = (Array.isArray(details?.items) ? details.items : []).map((item) => {
          const product = PRODUCT_CATALOG[item?.key];
          if (!product || String(product.sku || "").trim()) return null;
          return { key: item.key, label: product.label, quantity: Number(item.quantity || 0) };
        }).filter(Boolean);
        if (pendingItems.length) pendingMapping.push({
          floor,
          floor_label: areaLabel(floor, details),
          items: pendingItems,
        });
      });
      orders.push({
        submission_id: order.submission_id,
        customer_reference: order.customer_reference,
        company_name: order.company_name_snapshot || payload.customer || "",
        debtor_code: order.debtor_code_snapshot || payload.debtorCode || "",
        status: order.status,
        created_at: order.created_at,
        updated_at: order.updated_at,
        created_by_user_id: order.created_by_user_id || null,
        created_by_username: order.created_by_username_snapshot || "",
        created_by_name: order.created_by_name_snapshot || order.created_by_username_snapshot || "Legacy order",
        can_edit: false,
        can_archive: false,
        can_restore: false,
        can_delete: false,
        other_products: otherProducts,
        other_materials: otherMaterials,
        order_details: {
          reference: payload.reference || payload.customerReference || order.customer_reference,
          customer: payload.customer || order.company_name_snapshot || "",
          contact: payload.contact || payload.siteContact || "",
          mobile: payload.mobile || payload.siteContactPhone || "",
          delivery_address: payload.deliveryAddress || payload.siteAddress1 || "",
          delivery_instructions: payload.deliveryInstructions || payload.comments || "",
          required_date: payload.requiredDate || "",
          time_slot: payload.timeSlot || "",
          delivery_type: payload.deliveryType || "",
          extras: Array.isArray(payload.extras) ? payload.extras : [],
        },
        pending_mapping: pendingMapping,
        files,
      });
    }

    const staff = canViewAccountOrders
      ? await context.env.DB.prepare(
          `SELECT id, username, default_contact_name, active, is_primary
           FROM users WHERE account_id = ? ORDER BY is_primary DESC, default_contact_name COLLATE NOCASE, username COLLATE NOCASE`,
        ).bind(accountId).all()
      : { results: [] };

    return Response.json({
      ok: true,
      orders,
      viewer: {
        userId: Number(viewer.id),
        username: viewer.username,
        name: viewer.default_contact_name || viewer.username,
        role: viewer.role,
        isAccountSupervisor: Number(viewer.is_primary) === 1,
        scope: canViewAccountOrders ? "account" : "own",
      },
      staff: (staff.results || []).map((user) => ({
        id: Number(user.id),
        username: user.username,
        name: user.default_contact_name || user.username,
        active: Number(user.active) === 1,
        isAccountSupervisor: Number(user.is_primary) === 1,
      })),
      requestId,
    }, {
      headers: { "Cache-Control": "no-store", "X-Request-ID": requestId },
    });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || String(error), requestId }, {
      status: 500,
      headers: { "X-Request-ID": requestId },
    });
  }
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
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_orders_account_creator_created ON orders(account_id, created_by_user_id, created_at DESC)`).run();
}

function inferRevision(filename) {
  const match = String(filename || "").match(/-R(\d+)-[^/]+\.xlsx$/i);
  return match ? Number(match[1]) : 1;
}
