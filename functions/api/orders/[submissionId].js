import { prepareOrderFilesForViewer } from "../../_shared/order-email-attachments.js";
import {
  assertAdministrator,
  canViewOrder,
  getOrderScope,
  orderActionPermissions,
} from "../../_shared/order-permissions.js";
import {
  parseOrderPayload,
  resolveOrderViewSnapshot,
  snapshotToOrderPayload,
} from "../../_shared/order-view-model.js";
import { isAdministratorRole } from "../../_shared/user-roles.js";

export async function onRequestGet(context) {
  const requestId = crypto.randomUUID();
  try {
    const { db, viewer, submissionId } = await requireViewerContext(context);
    const order = await loadOrder(db, submissionId);
    if (!order || !canViewOrder(viewer, order)) return jsonError("Order not found.", 404, requestId);

    const payload = parseOrderPayload(order.payload_json);
    const storedSnapshot = await loadStoredSnapshot(db, submissionId);
    const snapshot = storedSnapshot
      ? resolveOrderViewSnapshot({ viewSnapshot: storedSnapshot }, order)
      : resolveOrderViewSnapshot(payload, order);
    const files = await loadPresentedFiles(db, submissionId, viewer);
    const eventsResult = await db.prepare(
      `SELECT stage, detail, created_at
       FROM order_events
       WHERE submission_id = ?
       ORDER BY id DESC
       LIMIT 50`,
    ).bind(submissionId).all();
    const permissions = orderActionPermissions(viewer, order.status);

    return Response.json({
      ok: true,
      order: {
        submissionId: order.submission_id,
        customerReference: order.customer_reference,
        status: order.status,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        accountId: Number(order.account_id || 0),
        companyName: order.company_name_snapshot || snapshot.details.customer || "",
        debtorCode: order.debtor_code_snapshot || payload.debtorCode || "",
        createdByUserId: order.created_by_user_id || null,
        createdByUsername: order.created_by_username_snapshot || "",
        createdByName: order.created_by_name_snapshot || order.created_by_username_snapshot || "Legacy order",
        createdByRole: order.creator_role || "",
        canArchive: permissions.canArchive,
        canRestore: permissions.canRestore,
        canDelete: permissions.canDelete,
      },
      viewer: {
        userId: Number(viewer.id),
        username: viewer.username,
        role: viewer.role,
        scope: getOrderScope(viewer),
      },
      snapshot,
      payload: snapshotToOrderPayload(snapshot),
      files,
      events: eventsResult.results || [],
      requestId,
    }, {
      headers: { "Cache-Control": "no-store", "X-Request-ID": requestId },
    });
  } catch (error) {
    return jsonError(error?.message || String(error), Number(error?.status || 500), requestId);
  }
}

export async function onRequestPut(context) {
  return readOnlyResponse(context);
}

export async function onRequestPatch(context) {
  const requestId = crypto.randomUUID();
  try {
    const { db, viewer, submissionId } = await requireAdministratorOrderContext(context);
    const body = await context.request.json().catch(() => ({}));
    const action = String(body?.action || "").trim().toLowerCase();
    if (!["archive", "restore"].includes(action)) {
      return jsonError("Action must be archive or restore.", 400, requestId);
    }

    const order = await db.prepare(
      `SELECT submission_id, customer_reference, status, account_id
       FROM orders
       WHERE submission_id = ?
       LIMIT 1`,
    ).bind(submissionId).first();
    if (!order) return jsonError("Order not found.", 404, requestId);

    const status = action === "archive" ? "archived" : "completed";
    await db.prepare(
      `UPDATE orders
       SET status = ?, updated_at = datetime('now')
       WHERE submission_id = ?`,
    ).bind(status, submissionId).run();

    return Response.json({
      ok: true,
      submissionId,
      customerReference: order.customer_reference,
      previousStatus: order.status,
      status,
      managedBy: Number(viewer.id),
      requestId,
    }, {
      headers: { "Cache-Control": "no-store", "X-Request-ID": requestId },
    });
  } catch (error) {
    return jsonError(error?.message || String(error), Number(error?.status || 500), requestId);
  }
}

export async function onRequestDelete(context) {
  const requestId = crypto.randomUUID();
  try {
    const { db, submissionId } = await requireAdministratorOrderContext(context);
    const order = await db.prepare(
      `SELECT submission_id, customer_reference, account_id
       FROM orders
       WHERE submission_id = ?
       LIMIT 1`,
    ).bind(submissionId).first();
    if (!order) return jsonError("Order not found.", 404, requestId);

    const fileRows = await db.prepare(
      `SELECT r2_key FROM order_files WHERE submission_id = ?`,
    ).bind(submissionId).all();

    if (context.env.ORDER_FILES) {
      for (const file of fileRows.results || []) {
        const key = String(file.r2_key || "").trim();
        if (!key) continue;
        try {
          await context.env.ORDER_FILES.delete(key);
        } catch (error) {
          console.error("Unable to delete order file from R2", {
            requestId,
            submissionId,
            key,
            error,
          });
        }
      }
    }

    await db.batch([
      db.prepare(`DELETE FROM order_view_snapshots WHERE submission_id = ?`).bind(submissionId),
      db.prepare(`DELETE FROM order_files WHERE submission_id = ?`).bind(submissionId),
      db.prepare(`DELETE FROM order_events WHERE submission_id = ?`).bind(submissionId),
      db.prepare(`DELETE FROM orders WHERE submission_id = ?`).bind(submissionId),
    ]);

    return Response.json({
      ok: true,
      deleted: true,
      submissionId,
      customerReference: order.customer_reference,
      accountId: Number(order.account_id || 0),
      requestId,
    }, {
      headers: { "Cache-Control": "no-store", "X-Request-ID": requestId },
    });
  } catch (error) {
    return jsonError(error?.message || String(error), Number(error?.status || 500), requestId);
  }
}

async function requireViewerContext(context) {
  if (!context.env.DB) {
    const error = new Error("Missing Cloudflare binding: DB");
    error.status = 500;
    throw error;
  }

  const auth = context.data?.auth;
  if (!auth?.userId) {
    const error = new Error("Authentication required.");
    error.status = 401;
    throw error;
  }

  const submissionId = String(context.params.submissionId || "").trim();
  if (!submissionId) {
    const error = new Error("Invalid order ID.");
    error.status = 400;
    throw error;
  }

  await ensureOrderViewSnapshotSchema(context.env.DB);
  const viewer = await context.env.DB.prepare(
    `SELECT id, account_id, username,
            COALESCE(NULLIF(access_role, ''), role) AS role,
            active, is_primary
     FROM users
     WHERE id = ? AND active = 1
     LIMIT 1`,
  ).bind(auth.userId).first();

  if (!viewer) {
    const error = new Error("Authentication required.");
    error.status = 401;
    throw error;
  }

  return { db: context.env.DB, viewer, submissionId };
}

async function requireAdministratorOrderContext(context) {
  const result = await requireViewerContext(context);
  assertAdministrator(result.viewer);
  return result;
}

function loadOrder(db, submissionId) {
  return db.prepare(
    `SELECT
       o.submission_id, o.customer_reference, o.status, o.created_at, o.updated_at,
       o.payload_json, o.account_id, o.company_name_snapshot, o.debtor_code_snapshot,
       o.created_by_user_id, o.created_by_username_snapshot, o.created_by_name_snapshot,
       COALESCE(NULLIF(creator.access_role, ''), creator.role) AS creator_role
     FROM orders o
     LEFT JOIN users creator ON creator.id = o.created_by_user_id
     WHERE o.submission_id = ?
     LIMIT 1`,
  ).bind(submissionId).first();
}

async function loadStoredSnapshot(db, submissionId) {
  const row = await db.prepare(
    `SELECT snapshot_json
     FROM order_view_snapshots
     WHERE submission_id = ?
     LIMIT 1`,
  ).bind(submissionId).first();
  return row?.snapshot_json ? parseOrderPayload(row.snapshot_json) : null;
}

async function loadPresentedFiles(db, submissionId, viewer) {
  const result = await db.prepare(
    `SELECT id, floor, floor_label, filename, r2_key, item_count, created_at
     FROM order_files
     WHERE submission_id = ?
     ORDER BY id DESC`,
  ).bind(submissionId).all();
  const files = (result.results || []).map((file) => ({
    ...file,
    revision: inferRevision(file.filename),
    download_url: `/api/files/${file.id}`,
  }));
  return prepareOrderFilesForViewer(files, { isAdmin: isAdministratorRole(viewer.role) });
}

function ensureOrderViewSnapshotSchema(db) {
  return db.prepare(
    `CREATE TABLE IF NOT EXISTS order_view_snapshots (
       submission_id TEXT PRIMARY KEY,
       schema_version INTEGER NOT NULL,
       snapshot_json TEXT NOT NULL,
       created_at TEXT NOT NULL,
       FOREIGN KEY (submission_id) REFERENCES orders(submission_id) ON DELETE CASCADE
     )`,
  ).run();
}

function readOnlyResponse(context) {
  const requestId = crypto.randomUUID();
  const auth = context.data?.auth;
  if (!auth?.userId) return jsonError("Authentication required.", 401, requestId);
  return Response.json({
    ok: false,
    error: "Submitted orders are read-only and cannot be edited or resubmitted.",
    requestId,
  }, {
    status: 405,
    headers: {
      Allow: "GET, PATCH, DELETE",
      "Cache-Control": "no-store",
      "X-Request-ID": requestId,
    },
  });
}

function inferRevision(filename) {
  const match = String(filename || "").match(/-R(\d+)-[^/]+\.xlsx$/i);
  return match ? Number(match[1]) : 1;
}

function jsonError(error, status, requestId) {
  return Response.json({ ok: false, error, requestId }, {
    status,
    headers: { "Cache-Control": "no-store", "X-Request-ID": requestId },
  });
}
