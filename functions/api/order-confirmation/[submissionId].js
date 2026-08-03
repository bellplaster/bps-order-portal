import { PRODUCT_CATALOG } from "../../_shared/catalog.js";
import { prepareOrderFilesForViewer } from "../../_shared/order-email-attachments.js";
import { canViewOrder } from "../../_shared/order-permissions.js";
import { effectiveUserRole, isAdministratorRole } from "../../_shared/user-roles.js";

export async function onRequestGet(context) {
  const requestId = crypto.randomUUID();
  try {
    if (!context.env.DB) throw new Error("Missing Cloudflare binding: DB");
    const auth = context.data?.auth;
    if (!auth?.userId) return jsonError("Authentication required.", 401, requestId);

    const submissionId = String(context.params.submissionId || "").trim();
    if (!submissionId) return jsonError("Invalid order ID.", 400, requestId);

    const viewer = await context.env.DB.prepare(
      `SELECT id, account_id, role, access_role, active, is_primary
       FROM users WHERE id = ? AND active = 1 LIMIT 1`,
    ).bind(auth.userId).first();
    if (!viewer) return jsonError("Authentication required.", 401, requestId);

    const effectiveViewer = {
      ...viewer,
      role: effectiveUserRole(viewer.role, viewer.access_role),
    };

    const order = await context.env.DB.prepare(
      `SELECT o.submission_id, o.customer_reference, o.status, o.created_at,
              o.payload_json, o.account_id, o.company_name_snapshot,
              o.debtor_code_snapshot, o.created_by_user_id,
              COALESCE(NULLIF(creator.access_role, ''), creator.role) AS creator_role
       FROM orders o
       LEFT JOIN users creator ON creator.id = o.created_by_user_id
       WHERE o.submission_id = ? LIMIT 1`,
    ).bind(submissionId).first();

    if (!order || !canViewOrder(effectiveViewer, order)) {
      return jsonError("Order not found.", 404, requestId);
    }

    const filesResult = await context.env.DB.prepare(
      `SELECT id, floor, floor_label, filename, item_count, created_at
       FROM order_files WHERE submission_id = ? ORDER BY id ASC`,
    ).bind(submissionId).all();
    const rawFiles = (filesResult.results || []).map((file) => ({
      id: Number(file.id),
      floor: file.floor,
      floorLabel: file.floor_label,
      filename: file.filename,
      itemCount: Number(file.item_count || 0),
      createdAt: file.created_at,
      downloadUrl: `/api/files/${file.id}`,
    }));
    const generatedFiles = prepareOrderFilesForViewer(rawFiles, {
      isAdmin: isAdministratorRole(effectiveViewer.role),
    });

    let payload = {};
    try {
      payload = JSON.parse(order.payload_json || "{}");
    } catch (_error) {
      payload = {};
    }

    const groups = buildProductGroups(payload);
    const totals = groups.reduce((summary, group) => ({
      lineCount: summary.lineCount + group.lines.length,
      unitCount: summary.unitCount + group.lines.reduce((sum, line) => sum + line.quantity, 0),
    }), { lineCount: 0, unitCount: 0 });

    return Response.json({
      ok: true,
      confirmation: {
        submissionId: order.submission_id,
        customerReference: order.customer_reference,
        companyName: order.company_name_snapshot || payload.customer || "Customer",
        debtorCode: order.debtor_code_snapshot || payload.debtorCode || "",
        createdAt: order.created_at,
        status: order.status,
        viewerRole: effectiveViewer.role,
        generatedFiles,
        groups,
        totals,
        details: {
          contact: payload.contact || payload.siteContact || "",
          mobile: payload.mobile || payload.siteContactPhone || "",
          requiredDate: payload.requiredDate || "",
          timeSlot: payload.timeSlot || "ANY",
          deliveryType: payload.deliveryType || "",
          deliveryAddress: payload.deliveryAddress
            || [payload.addressLine1, payload.addressLine2].filter(Boolean).join(", "),
          addressLine1: payload.addressLine1 || payload.siteAddress1 || "",
          addressLine2: payload.addressLine2 || payload.siteAddress2 || "",
          extras: Array.isArray(payload.extras) ? payload.extras : [],
          instructions: payload.deliveryInstructions || payload.instructions || payload.comments || "",
        },
      },
      requestId,
    }, {
      headers: { "Cache-Control": "private, no-store", "X-Request-ID": requestId },
    });
  } catch (error) {
    return jsonError(error?.message || String(error), Number(error?.status || 500), requestId);
  }
}

function buildProductGroups(payload) {
  return Object.entries(payload?.floors && typeof payload.floors === "object" ? payload.floors : {})
    .map(([key, area], index) => {
      const lines = [];
      for (const item of Array.isArray(area?.items) ? area.items : []) {
        const quantity = Number(item?.quantity || 0);
        if (!Number.isInteger(quantity) || quantity <= 0) continue;
        const product = PRODUCT_CATALOG[String(item?.key || "").trim()] || {};
        lines.push({
          sku: String(item?.sku || product.sku || "").trim().toUpperCase(),
          description: String(
            item?.description || item?.name || product.description || product.label || item?.key || "Product",
          ).trim(),
          quantity,
        });
      }
      for (const item of Array.isArray(area?.otherMaterials) ? area.otherMaterials : []) {
        const quantity = Number(item?.quantity || 0);
        if (!Number.isInteger(quantity) || quantity <= 0) continue;
        lines.push({
          sku: String(item?.sku || "").trim().toUpperCase(),
          description: String(item?.description || item?.name || item?.sku || "Product").trim(),
          quantity,
        });
      }
      return {
        key,
        label: String(area?.label || defaultAreaLabel(key, index)).trim(),
        lines,
      };
    })
    .filter((group) => group.lines.length);
}

function defaultAreaLabel(key, index) {
  if (key === "ground") return "Ground Floor";
  if (key === "first") return "1st Floor";
  return `Tab ${index + 1}`;
}

function jsonError(error, status, requestId) {
  return Response.json({ ok: false, error, requestId }, {
    status,
    headers: { "Cache-Control": "private, no-store", "X-Request-ID": requestId },
  });
}
