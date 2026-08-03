import { processOrderSubmission } from "../_shared/orders-v2.js";
import { sendOrderFilesEmail } from "../_shared/order-email.js";
import { prepareOrderFilesForViewer } from "../_shared/order-email-attachments.js";
import { effectiveUserRole, isAdministratorRole } from "../_shared/user-roles.js";
import { reconcileStandardProductItems } from "../_shared/product-payload.js";
import { createMatrixAwareDb } from "../_shared/matrix-catalog-db.js";
import { replaceAreaExportsWithCombined } from "../_shared/combined-accrivia-export.js";

export async function onRequestPost(context) {
  const requestId = crypto.randomUUID();
  let payload = null;
  let actor = null;
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
    await ensureOrderTrackingSchema(context.env.DB);
    actor = await context.env.DB.prepare(
      `SELECT id, account_id, username, role, access_role, active, default_contact_name
       FROM users WHERE id = ? AND active = 1 LIMIT 1`,
    ).bind(auth.userId).first();
    const accountId = Number(actor?.account_id || 0);
    if (!actor || !accountId) {
      return Response.json(
        { ok: false, error: "Your login is not assigned to a customer account.", requestId },
        { status: 400, headers: { "Cache-Control": "no-store", "X-Request-ID": requestId } },
      );
    }
    payload.customerAccountId = accountId;

    const reference = String(payload.reference || payload.customerReference || "").trim();
    const submissionId = String(payload.submissionId || "").trim();
    if (!/^\d+(?:-\d+)*$/.test(reference)) {
      return Response.json(
        { ok: false, error: "Reference must use numbers with optional single dashes, for example 8888-1.", requestId },
        { status: 400, headers: { "Cache-Control": "no-store", "X-Request-ID": requestId } },
      );
    }

    await removeFailedSubmission(context.env, { accountId, reference, submissionId });

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

    assertPayloadHasProducts(payload);
    await reconcileStandardProductItems(context.env, payload);
    assertPayloadHasProducts(payload);

    const submissionEnv = {
      ...context.env,
      DB: createMatrixAwareDb(context.env.DB, payload),
    };

    const result = await processOrderSubmission(submissionEnv, payload, { ...auth, accountId });
    await stampOrderCreator(context.env.DB, result.submissionId || submissionId, actor);
    await replaceAreaExportsWithCombined(context.env, payload, result, { ...auth, accountId });
    await preservePickupSiteReference(context.env, payload, result).catch((error) => {
      console.warn("Pickup site reference could not be stored.", error);
    });

    const actorRole = effectiveUserRole(actor?.role, actor?.access_role);
    const isAdminOrder = isAdministratorRole(actorRole);
    const presentedFiles = prepareOrderFilesForViewer(result.generatedFiles, { isAdmin: isAdminOrder });

    let email = { sent: false, reason: "not_attempted" };
    try {
      const emailEnv = orderEmailEnvironment(context.env, actorRole);
      const emailResult = {
        ...result,
        generatedFiles: presentedFiles,
      };
      email = await sendOrderFilesEmail(emailEnv, payload, emailResult, { ...auth, accountId });
    } catch (error) {
      email = { sent: false, reason: "send_failed", error: error?.message || String(error) };
      console.error("Order email could not be sent.", error);
    }

    return Response.json({
      ...result,
      generatedFiles: presentedFiles,
      viewerRole: actorRole,
      emailSent: email.sent === true,
      emailMessageId: email.messageId || null,
      emailStatus: email.reason || (email.sent ? "sent" : "not_sent"),
      requestId,
    }, { headers: { "Cache-Control": "no-store", "X-Request-ID": requestId } });
  } catch (error) {
    await removeFailedSubmission(context.env, {
      accountId: Number(actor?.account_id || payload?.customerAccountId || context.data?.auth?.accountId || 0),
      reference: String(payload?.reference || payload?.customerReference || "").trim(),
      submissionId: String(payload?.submissionId || "").trim(),
    }).catch(() => null);

    const message = error?.message || String(error);
    const inferredStatus = /already been used|is required|invalid|cannot|must|contains no products|complete Victorian/i.test(message) ? 400 : 500;
    const status = Number(error?.status || inferredStatus);
    return Response.json({ ok: false, error: message, diagnostic: error?.diagnostic || null, requestId }, { status, headers: { "X-Request-ID": requestId } });
  }
}

function orderEmailEnvironment(env, actorRole) {
  if (!isAdministratorRole(actorRole)) return env;
  return {
    ...env,
    ORDER_EMAIL_TO: "marketing@bellplaster.com.au",
    ORDER_EMAIL_CC: "",
  };
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

async function stampOrderCreator(db, submissionId, actor) {
  const username = String(actor?.username || "").trim();
  const name = String(actor?.default_contact_name || username).trim();
  await db.prepare(
    `UPDATE orders
     SET created_by_user_id = ?, created_by_username_snapshot = ?, created_by_name_snapshot = ?
     WHERE submission_id = ?`,
  ).bind(Number(actor.id), username, name, submissionId).run();
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
