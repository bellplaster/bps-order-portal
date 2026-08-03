import { assertAdministrator } from "../../_shared/order-permissions.js";

export async function onRequestGet(context) {
  return readOnlyResponse(context);
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

async function requireAdministratorOrderContext(context) {
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

  const viewer = await context.env.DB.prepare(
    `SELECT id, account_id, role, active
     FROM users
     WHERE id = ? AND active = 1
     LIMIT 1`,
  ).bind(auth.userId).first();

  if (!viewer) {
    const error = new Error("Authentication required.");
    error.status = 401;
    throw error;
  }

  assertAdministrator(viewer);
  return { db: context.env.DB, viewer, submissionId };
}

function readOnlyResponse(context) {
  const requestId = crypto.randomUUID();
  const auth = context.data?.auth;
  if (!auth?.userId) return jsonError("Authentication required.", 401, requestId);
  return Response.json({
    ok: false,
    error: "Submitted orders cannot be edited or resubmitted.",
    requestId,
  }, {
    status: 405,
    headers: {
      Allow: "PATCH, DELETE",
      "Cache-Control": "no-store",
      "X-Request-ID": requestId,
    },
  });
}

function jsonError(error, status, requestId) {
  return Response.json({ ok: false, error, requestId }, {
    status,
    headers: { "Cache-Control": "no-store", "X-Request-ID": requestId },
  });
}
