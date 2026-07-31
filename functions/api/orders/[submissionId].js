export async function onRequestGet(context) {
  return readOnlyResponse(context);
}

export async function onRequestPut(context) {
  return readOnlyResponse(context);
}

export async function onRequestPatch(context) {
  return readOnlyResponse(context);
}

export async function onRequestDelete(context) {
  const requestId = crypto.randomUUID();
  try {
    if (!context.env.DB) throw new Error("Missing Cloudflare binding: DB");
    const auth = context.data?.auth;
    if (!auth?.userId) return jsonError("Authentication required.", 401, requestId);

    const submissionId = String(context.params.submissionId || "").trim();
    if (!submissionId) return jsonError("Invalid order ID.", 400, requestId);

    const viewer = await context.env.DB.prepare(
      `SELECT id, account_id, role, active
       FROM users
       WHERE id = ? AND active = 1
       LIMIT 1`,
    ).bind(auth.userId).first();

    if (!viewer) return jsonError("Authentication required.", 401, requestId);
    if (viewer.role !== "admin") {
      return jsonError("Only an administrator can permanently delete an order.", 403, requestId);
    }

    const accountId = Number(viewer.account_id || 0);
    if (!accountId) return jsonError("Your administrator login is not assigned to an account.", 403, requestId);

    const order = await context.env.DB.prepare(
      `SELECT submission_id, customer_reference
       FROM orders
       WHERE submission_id = ? AND account_id = ?
       LIMIT 1`,
    ).bind(submissionId, accountId).first();

    if (!order) return jsonError("Order not found.", 404, requestId);

    const fileRows = await context.env.DB.prepare(
      `SELECT r2_key FROM order_files WHERE submission_id = ?`,
    ).bind(submissionId).all();

    if (context.env.ORDER_FILES) {
      for (const file of fileRows.results || []) {
        const key = String(file.r2_key || "").trim();
        if (!key) continue;
        try {
          await context.env.ORDER_FILES.delete(key);
        } catch (error) {
          console.error("Unable to delete order file from R2", { requestId, submissionId, key, error });
        }
      }
    }

    await context.env.DB.batch([
      context.env.DB.prepare(`DELETE FROM order_files WHERE submission_id = ?`).bind(submissionId),
      context.env.DB.prepare(`DELETE FROM orders WHERE submission_id = ? AND account_id = ?`).bind(submissionId, accountId),
    ]);

    return Response.json({
      ok: true,
      deleted: true,
      submissionId,
      customerReference: order.customer_reference,
      requestId,
    }, {
      headers: { "Cache-Control": "no-store", "X-Request-ID": requestId },
    });
  } catch (error) {
    return jsonError(error?.message || String(error), 500, requestId);
  }
}

function readOnlyResponse(context) {
  const requestId = crypto.randomUUID();
  const auth = context.data?.auth;
  if (!auth?.userId) return jsonError("Authentication required.", 401, requestId);
  return Response.json({
    ok: false,
    error: "Submitted orders cannot be edited, resubmitted, archived or restored.",
    requestId,
  }, {
    status: 405,
    headers: {
      Allow: "DELETE",
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
