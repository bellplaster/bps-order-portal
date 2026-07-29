import { normaliseAustralianPhone } from "../_shared/phone.js";
import { json } from "../_shared/responses.js";

const TIME_SLOTS = new Set(["", "1ST", "2ND", "AM", "PM", "ANY"]);
const DELIVERY_TYPES = new Set(["", "Hand Unload", "Forklift Delivery", "Crane Delivery", "Delivery (No Assistance)", "Pickup (Customer to collect)"]);

export async function onRequestPut(context) {
  try {
    const auth = requireAdmin(context);
    const body = await context.request.json().catch(() => null);
    if (!body || typeof body !== "object") throw badRequest("Invalid administrator defaults request.");

    const defaultContactName = cleanOptional(body.defaultContactName, 100);
    const defaultMobile = normaliseAustralianPhone(body.defaultMobile, {
      optional: true,
      error: "Enter a valid Australian phone number.",
    });
    const orderDefaults = cleanOrderDefaults(body.orderDefaults);

    const result = await context.env.DB.prepare(
      `UPDATE users
       SET default_contact_name = ?, default_mobile = ?, order_defaults_json = ?, updated_at = ?
       WHERE id = ? AND role = 'admin'`,
    ).bind(
      defaultContactName,
      defaultMobile,
      JSON.stringify(orderDefaults),
      new Date().toISOString(),
      auth.userId,
    ).run();

    if (!Number(result?.meta?.changes || 0)) throw forbidden("Administrator account not found.");
    return json({ ok: true }, 200);
  } catch (error) {
    return json({ ok: false, error: error?.message || String(error) }, Number(error?.status || 500));
  }
}

function cleanOrderDefaults(input) {
  const source = input && typeof input === "object" ? input : {};
  const reference = cleanOptional(source.reference, 80);
  if (reference && !/^\d+$/.test(reference)) throw badRequest("Default reference must contain numbers only.");

  const requiredDate = /^\d{4}-\d{2}-\d{2}$/.test(String(source.requiredDate || ""))
    ? String(source.requiredDate)
    : "";
  const postcode = cleanOptional(source.postcode, 4);
  if (postcode && !/^(?:3\d{3}|8\d{3})$/.test(postcode)) {
    throw badRequest("Default postcode must be a Victorian postcode.");
  }

  const timeSlot = String(source.timeSlot || "").trim().toUpperCase();
  if (!TIME_SLOTS.has(timeSlot)) throw badRequest("Choose a valid default time slot.");
  const deliveryType = String(source.deliveryType || "").trim();
  if (!DELIVERY_TYPES.has(deliveryType)) throw badRequest("Choose a valid default delivery type.");

  return {
    reference,
    requiredDate,
    street: cleanOptional(source.street, 240),
    suburb: cleanOptional(source.suburb, 120),
    state: "VIC",
    postcode,
    timeSlot,
    deliveryType,
    extras: [],
    instructions: cleanMultiline(source.instructions, 1500),
  };
}

function requireAdmin(context) {
  if (!context.env.DB) throw new Error("Missing Cloudflare binding: DB");
  const auth = context.data?.auth;
  if (!auth?.userId) throw forbidden("Authentication required.");
  if (auth.role !== "admin") throw forbidden("Administrator access required.");
  return auth;
}

function cleanOptional(value, maxLength) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanMultiline(value, maxLength) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, maxLength);
}

function withStatus(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}
function badRequest(message) { return withStatus(message, 400); }
function forbidden(message) { return withStatus(message, 403); }
