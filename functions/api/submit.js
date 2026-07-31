import { processOrderSubmission } from "../_shared/orders-v2.js";
import { sendOrderFilesEmail } from "../_shared/order-email.js";
import { reconcileStandardProductItems } from "../_shared/product-payload.js";
import { createMatrixAwareDb } from "../_shared/matrix-catalog-db.js";
import { replaceAreaExportsWithCombined } from "../_shared/combined-accrivia-export.js";

export async function onRequestPost(context) {
  const requestId = crypto.randomUUID();
  let payload = null;
  try {
    const contentLength = Number(context.request.headers.get("Content-Length") || 0);
    if (contentLength > 200_000) {
      return Response.json({ ok: false, error: "The submission exceeds the 200 KB request limit.", requestId }, { status: 413, headers: { "X-Request-ID": requestId } });
    }

    payload = await context.request.json().catch(() => null);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return Response.json({ ok: false, error: "The portal submitted invalid JSON.", requestId }, { status: 400, headers: { "X-Request-ID": requestId } });
    }

    const auth = context.data?.auth || {};
    let accountId = Number(auth.accountId || 0);

    if (auth.role === "admin") {
      const currentAdmin = await context.env.DB.prepare(
        `SELECT account_id FROM users WHERE id = ? AND role = 'admin' AND active = 1 LIMIT 1`,
      ).bind(auth.userId).first();
      accountId = Number(currentAdmin?.account_id || 0);
      if (!accountId) {
        return Response.json(
          { ok: false, error: "Your administrator login is not assigned to a customer account.", requestId },
          { status: 400, headers: { "Cache-Control": "no-store", "X-Request-ID": requestId } },
        );
      }
      payload.customerAccountId = accountId;
    }

    const reference = String(payload.reference || payload.customerReference || "").trim();
    const submissionId = String(payload.submissionId || "").trim();
    if (!/^\d+(?:-\d+)*$/.test(reference)) {
      return Response.json(
        { ok: false, error: "Reference must use numbers with optional single dashes, for example 8888-1.", requestId },
        { status: 400, headers: { "Cache-Control": "no-store", "X-Request-ID": requestId } },
      );
    }

    await removeFailedSubmission(context.env, { accountId, reference, submissionId });

    if (accountId && context.env.DB) {
      const duplicate = await context.env.DB.prepare(
        `SELECT submission_id
         FROM orders
         WHERE account_id = ?
           AND customer_reference = ? COLLATE NOCASE
           AND submission_id <> ?
           AND status <> 'failed'
         LIMIT 1`,
      ).bind(accountId, reference, submissionId).first();
      if (duplicate) {
        return Response.json(
          { ok: false, error: `PO number "${reference}" has already been used for this customer.`, requestId },
          { status: 400, headers: { "Cache-Control": "no-store", "X-Request-ID": requestId } },
        );
      }
    }

    assertPayloadHasProducts(payload);
    await reconcileStandardProductItems(context.env, payload);
    assertPayloadHasProducts(payload);

    const submissionEnv = {
      ...context.env,
      DB: createMatrixAwareDb(context.env.DB, payload),
    };

    const result = await processOrderSubmission(submissionEnv, payload, auth);
    await replaceAreaExportsWithCombined(context.env, payload, result, {
      ...auth,
      accountId: Number(payload.customerAccountId || auth.accountId || accountId || 0),
    });
    await preservePickupSiteReference(context.env, payload, result).catch((error) => {
      console.warn("Pickup site reference could not be stored.", error);
    });

    let email = { sent: false, reason: "not_attempted" };
    try {
      email = await sendOrderFilesEmail(context.env, payload, result, auth);
    } catch (error) {
      email = { sent: false, reason: "send_failed", error: error?.message || String(error) };
      console.error("Order email could not be sent.", error);
    }

    return Response.json({
      ...result,
      emailSent: email.sent === true,
      emailMessageId: email.messageId || null,
      emailStatus: email.reason || (email.sent ? "sent" : "not_sent"),
      requestId,
    }, { headers: { "Cache-Control": "no-store", "X-Request-ID": requestId } });
  } catch (error) {
    await removeFailedSubmission(context.env, {
      accountId: Number(payload?.customerAccountId || context.data?.auth?.accountId || 0),
      reference: String(payload?.reference || payload?.customerReference || "").trim(),
      submissionId: String(payload?.submissionId || "").trim(),
    }).catch(() => null);

    const message = error?.message || String(error);
    const inferredStatus = /already been used|is required|invalid|cannot|must|contains no products|complete Victorian/i.test(message) ? 400 : 500;
    const status = Number(error?.status || inferredStatus);
    return Response.json({ ok: false, error: message, diagnostic: error?.diagnostic || null, requestId }, { status, headers: { "X-Request-ID": requestId } });
  }
}

function assertPayloadHasProducts(payload) {
  const floors = payload?.floors;
  if (!floors || typeof floors !== "object" || Array.isArray(floors)) {
    throw clientError("Submission failed: no product tabs were included in the order payload.");
  }

  const hasProducts = Object.values(floors).some((area) => {
    if (!area || typeof area !== "object") return false;
    const standard = Array.isArray(area.items) && area.items.some((item) => Number(item?.quantity) > 0);
    const additional = Array.isArray(area.otherMaterials) && area.otherMaterials.some((item) => Number(item?.quantity) > 0);
    return standard || additional || Boolean(String(area.otherProducts || "").trim());
  });

  if (!hasProducts) throw clientError("Submission failed: the order payload contains no products. Return to the order and try again.");
}

async function removeFailedSubmission(env, { accountId, reference, submissionId }) {
  if (!env?.DB) return;
  const ids = new Set();
  if (submissionId) ids.add(submissionId);

  if (accountId && reference) {
    const result = await env.DB.prepare(
      `SELECT submission_id FROM orders
       WHERE account_id = ? AND customer_reference = ? COLLATE NOCASE AND status = 'failed'`,
    ).bind(accountId, reference).all();
    (result.results || []).forEach((row) => ids.add(String(row.submission_id || "")));
  }

  for (const id of ids) {
    if (!id) continue;
    await env.DB.prepare(`DELETE FROM order_files WHERE submission_id = ?`).bind(id).run().catch(() => null);
    await env.DB.prepare(`DELETE FROM order_events WHERE submission_id = ?`).bind(id).run().catch(() => null);
    await env.DB.prepare(`DELETE FROM orders WHERE submission_id = ? AND status = 'failed'`).bind(id).run().catch(() => null);
  }
}

function clientError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

async function preservePickupSiteReference(env, payload, result) {
  if (!env?.DB || !/pickup|pick\s*up|collect/i.test(String(payload?.deliveryType || ""))) return;
  const submissionId = String(result?.submissionId || payload?.submissionId || "").trim();
  if (!submissionId) return;
  const street = String(payload?.addressLine1 || "").trim();
  const suburbStatePostcode = String(payload?.addressLine2 || "").trim();
  if (!suburbStatePostcode) return;
  await env.DB.prepare(
    `UPDATE orders
     SET site_address = ?, suburb_state_postcode = ?
     WHERE submission_id = ?`,
  ).bind(street, suburbStatePostcode, submissionId).run();
}
