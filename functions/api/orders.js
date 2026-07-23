import { PRODUCT_CATALOG } from "../_shared/catalog.js";

export async function onRequestGet(context) {
  const requestId = crypto.randomUUID();
  try {
    if (!context.env.DB) throw new Error("Missing Cloudflare binding: DB");
    const auth = context.data?.auth;
    if (!auth?.userId) return Response.json({ ok: false, error: "Authentication required.", requestId }, { status: 401 });

    const where = auth.role === "admin" ? "" : "WHERE o.account_id = ?";
    const sql = `SELECT
       o.submission_id, o.customer_reference, o.status, o.created_at, o.updated_at,
       o.payload_json, o.account_id, o.company_name_snapshot, o.debtor_code_snapshot
     FROM orders o ${where}
     ORDER BY o.created_at DESC LIMIT 100`;
    const query = context.env.DB.prepare(sql);
    const ordersResult = auth.role === "admin"
      ? await query.all()
      : await query.bind(auth.accountId).all();

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
        can_edit: !["cancelled", "archived"].includes(order.status),
        can_archive: order.status !== "archived",
        can_restore: order.status === "archived",
        can_delete: true,
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
        latest_revision: Math.max(1, ...files.map((file) => file.revision)),
        files,
      });
    }

    return Response.json({ ok: true, orders, requestId }, {
      headers: { "Cache-Control": "no-store", "X-Request-ID": requestId },
    });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || String(error), requestId }, {
      status: 500,
      headers: { "X-Request-ID": requestId },
    });
  }
}

function inferRevision(filename) {
  const match = String(filename || "").match(/-R(\d+)-[^/]+\.xlsx$/i);
  return match ? Number(match[1]) : 1;
}