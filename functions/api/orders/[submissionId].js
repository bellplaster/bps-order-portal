import {
  deleteOrderPermanently,
  getOrderForEditing,
  setOrderArchiveStatus,
  updateOrderSubmission,
} from "../../_shared/orders-v2.js";

export async function onRequestGet(context) {
  return handle(context, async () => getOrderForEditing(
    context.env,
    String(context.params.submissionId || ""),
    context.data?.auth,
  ));
}

export async function onRequestPut(context) {
  return handle(context, async () => {
    const payload = await context.request.json().catch(() => null);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw requestError("The portal submitted invalid JSON.");
    return updateOrderSubmission(
      context.env,
      String(context.params.submissionId || ""),
      payload,
      context.data?.auth,
    );
  });
}

export async function onRequestPatch(context) {
  return handle(context, async () => {
    const payload = await context.request.json().catch(() => null);
    const action = String(payload?.action || "").trim().toLowerCase();
    if (!["archive", "restore"].includes(action)) throw requestError('Action must be "archive" or "restore".');
    return setOrderArchiveStatus(
      context.env,
      String(context.params.submissionId || ""),
      action === "archive",
      context.data?.auth,
    );
  });
}

export async function onRequestDelete(context) {
  return handle(context, async () => deleteOrderPermanently(
    context.env,
    String(context.params.submissionId || ""),
    context.data?.auth,
  ));
}

async function handle(context, operation) {
  const requestId = crypto.randomUUID();
  try {
    const result = await operation();
    return Response.json({ ...result, requestId }, { headers: { "Cache-Control": "no-store", "X-Request-ID": requestId } });
  } catch (error) {
    const message = error?.message || String(error);
    const status = error?.status || (message === "Order not found." ? 404 : /invalid|required|cannot|must/i.test(message) ? 400 : 500);
    return Response.json({ ok: false, error: message, diagnostic: error?.diagnostic || null, requestId }, { status, headers: { "X-Request-ID": requestId } });
  }
}

function requestError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}