import { PRODUCT_CATALOG } from "../_shared/catalog.js";
import { prepareOrderFilesForViewer } from "../_shared/order-email-attachments.js";
import {
  ADMIN_TEST_DEBTOR_CODE,
  getOrderScope,
  orderActionPermissions,
} from "../_shared/order-permissions.js";
import { isAdministratorRole } from "../_shared/user-roles.js";

export async function onRequestGet(context) {
  const requestId = crypto.randomUUID();
  try {
    if (!context.env.DB) throw new Error("Missing Cloudflare binding: DB");
    const auth = context.data?.auth;
    if (!auth?.userId) return Response.json({ ok: false, error: "Authentication required.", requestId }, { status: 401 });

    await ensureOrderTrackingSchema(context.env.DB);
    const viewer = await context.env.DB.prepare(
      `SELECT id, account_id, username,
              COALESCE(NULLIF(access_role, ''), role) AS role,
              active, is_primary, default_contact_name
       FROM users WHERE id = ? AND active = 1 LIMIT 1`,
    ).bind(auth.userId).first();

    if (!viewer) {
      return Response.json({ ok: false, error: "Authentication required.", requestId }, { status: 401 });
    }

    const scope = getOrderScope(viewer);
    const accountId = Number(viewer.account_id || 0);
    if (["account", "own"].includes(scope) && !accountId) {
      return Response.json({ ok: false, error: "Your login is not assigned to a customer account.", requestId }, { status: 400 });
    }

    const { where, bindings } = buildOrderScope(scope, viewer);
    const query = context.env.DB.prepare(
      `SELECT
         o.submission_id, o.customer_reference, o.status, o.created_at, o.updated_at,
         o.payload_json, o.account_id, o.company_name_snapshot, o.debtor_code_snapshot,
         o.created_by_user_id, o.created_by_username_snapshot, o.created_by_name_snapshot,
         COALESCE(NULLIF(creator.access_role, ''), creator.role) AS creator_role
       FROM orders o
       LEFT JOIN users creator ON creator.id = o.created_by_user_id
       ${where}
       ORDER BY o.created_at DESC
       LIMIT 500`,
    );
    const ordersResult = bindings.length ? await query.bind(...bindings).all() : await query.all();

    const orders = [];
    for (const order of ordersResult.results || []) {
      const filesResult = await context.env.DB.prepare(
        `SELECT id, floor, floor_label, filename, r2_key, item_count, created_at
         FROM order_files WHERE submission_id = ? ORDER BY id DESC`,
      ).bind(order.submission_id).all();

      const rawFiles = (filesResult.results || []).map((file) => ({
        ...file,
        revision: inferRevision(file.filename),
        download_url: `/api/files/${file.id}`,
      }));
      const files = prepareOrderFilesForViewer(rawFiles, {
        isAdmin: isAdministratorRole(viewer.role),
      });

      let payload = {};
      try {
        payload = JSON.parse(order.payload_json || "{}");
      } catch (_error) {
        payload = {};
      }

      const areaLabel = (floor, details) => details?.label
        || (floor === "first" ? "1st Floor" : floor === "ground" ? "Ground Floor" : floor);
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
        if (pendingItems.length) {
          pendingMapping.push({
            floor,
            floor_label: areaLabel(floor, details),
            items: pendingItems,
          });
        }
      });

      const permissions = orderActionPermissions(viewer, order.status);
      orders.push({
        submission_id: order.submission_id,
        customer_reference: order.customer_reference,
        account_id: Number(order.account_id || 0),
        company_name: order.company_name_snapshot || payload.customer || "",
        debtor_code: order.debtor_code_snapshot || payload.debtorCode || "",
        status: order.status,
        created_at: order.created_at,
        updated_at: order.updated_at,
        created_by_user_id: order.created_by_user_id || null,
        created_by_username: order.created_by_username_snapshot || "",
        created_by_name: order.created_by_name_snapshot || order.created_by_username_snapshot || "Legacy order",
        created_by_role: order.creator_role || "",
        can_edit: permissions.canEdit,
        can_archive: permissions.canArchive,
        can_restore: permissions.canRestore,
        can_delete: permissions.canDelete,
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

    const staffResult = await loadVisibleStaff(context.env.DB, scope, accountId);
    const accountsResult = await loadVisibleAccounts(context.env.DB, scope);

    return Response.json({
      ok: true,
      orders,
      viewer: {
        userId: Number(viewer.id),
        username: viewer.username,
        name: viewer.default_contact_name || viewer.username,
        role: viewer.role,
        isAccountSupervisor: Number(viewer.is_primary) === 1,
        scope,
      },
      staff: (staffResult.results || []).map((user) => ({
        id: Number(user.id),
        accountId: Number(user.account_id || 0),
        companyName: user.company_name || "",
        username: user.username,
        name: user.default_contact_name || user.username,
        active: Number(user.active) === 1,
        isAccountSupervisor: Number(user.is_primary) === 1,
      })),
      accounts: (accountsResult.results || []).map((account) => ({
        id: Number(account.id),
        debtorCode: account.debtor_code,
        companyName: account.company_name,
        active: Number(account.active) === 1,
      })),
      requestId,
    }, {
      headers: { "Cache-Control": "no-store", "X-Request-ID": requestId },
    });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || String(error), requestId }, {
      status: Number(error?.status || 500),
      headers: { "X-Request-ID": requestId },
    });
  }
}

function buildOrderScope(scope, viewer) {
  if (scope === "all") return { where: "", bindings: [] };
  if (scope === "staff") {
    return {
      where: `WHERE UPPER(COALESCE(o.debtor_code_snapshot, '')) <> ?
                AND COALESCE(NULLIF(creator.access_role, ''), creator.role, '') <> 'admin'`,
      bindings: [ADMIN_TEST_DEBTOR_CODE],
    };
  }
  if (scope === "account") {
    return { where: "WHERE o.account_id = ?", bindings: [Number(viewer.account_id)] };
  }
  return {
    where: "WHERE o.account_id = ? AND o.created_by_user_id = ?",
    bindings: [Number(viewer.account_id), Number(viewer.id)],
  };
}

function loadVisibleAccounts(db, scope) {
  if (scope === "all") {
    return db.prepare(
      `SELECT id, debtor_code, company_name, active
       FROM customer_accounts
       ORDER BY company_name COLLATE NOCASE, debtor_code COLLATE NOCASE`,
    ).all();
  }
  if (scope === "staff") {
    return db.prepare(
      `SELECT id, debtor_code, company_name, active
       FROM customer_accounts
       WHERE UPPER(debtor_code) <> ?
       ORDER BY company_name COLLATE NOCASE, debtor_code COLLATE NOCASE`,
    ).bind(ADMIN_TEST_DEBTOR_CODE).all();
  }
  return Promise.resolve({ results: [] });
}

function loadVisibleStaff(db, scope, accountId) {
  if (scope === "all") {
    return db.prepare(
      `SELECT u.id, u.account_id, u.username, u.default_contact_name, u.active, u.is_primary,
              a.company_name
       FROM users u
       LEFT JOIN customer_accounts a ON a.id = u.account_id
       ORDER BY a.company_name COLLATE NOCASE, u.is_primary DESC,
                u.default_contact_name COLLATE NOCASE, u.username COLLATE NOCASE`,
    ).all();
  }
  if (scope === "staff") {
    return db.prepare(
      `SELECT u.id, u.account_id, u.username, u.default_contact_name, u.active, u.is_primary,
              a.company_name
       FROM users u
       INNER JOIN customer_accounts a ON a.id = u.account_id
       WHERE COALESCE(NULLIF(u.access_role, ''), u.role) = 'customer'
         AND UPPER(a.debtor_code) <> ?
       ORDER BY a.company_name COLLATE NOCASE, u.is_primary DESC,
                u.default_contact_name COLLATE NOCASE, u.username COLLATE NOCASE`,
    ).bind(ADMIN_TEST_DEBTOR_CODE).all();
  }
  if (scope === "account") {
    return db.prepare(
      `SELECT u.id, u.account_id, u.username, u.default_contact_name, u.active, u.is_primary,
              a.company_name
       FROM users u
       LEFT JOIN customer_accounts a ON a.id = u.account_id
       WHERE u.account_id = ?
       ORDER BY u.is_primary DESC, u.default_contact_name COLLATE NOCASE, u.username COLLATE NOCASE`,
    ).bind(accountId).all();
  }
  return Promise.resolve({ results: [] });
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
  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_orders_account_creator_created
     ON orders(account_id, created_by_user_id, created_at DESC)`,
  ).run();
}

function inferRevision(filename) {
  const match = String(filename || "").match(/-R(\d+)-[^/]+\.xlsx$/i);
  return match ? Number(match[1]) : 1;
}
