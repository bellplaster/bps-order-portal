import { PRODUCT_CATALOG } from "./catalog.js";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAX_ATTACHMENT_BYTES = 3_500_000;
const DEFAULT_FROM = "portal@orders.bellplaster.com.au";
const DEFAULT_TO = "info@bellplaster.com.au";
const DEFAULT_CC = "";
const DEFAULT_REPLY_TO = "info@bellplaster.com.au";
const DEFAULT_PORTAL_URL = "https://orders.bellplaster.com.au/";
const DEFAULT_LOGO_URL = "https://assets.bellplaster.com.au/bell_logo_black.png";
const COMPANY_ADDRESS = "125 Sussex Street, Pascoe Vale VIC 3044";

export async function sendOrderFilesEmail(env, payload, result, auth = {}) {
  const accountId = String(env?.CLOUDFLARE_ACCOUNT_ID || "").trim();
  const token = String(env?.CLOUDFLARE_EMAIL_API_TOKEN || "").trim();
  if (!accountId || !token) return { sent: false, reason: "not_configured" };
  if (!env?.ORDER_FILES?.get) return { sent: false, reason: "files_binding_missing" };

  const files = Array.isArray(result?.generatedFiles) ? result.generatedFiles : [];
  if (!files.length) return { sent: false, reason: "no_files" };

  const attachments = [];
  let attachmentBytes = 0;
  for (const file of files) {
    const key = String(file?.r2Key || "").trim();
    if (!key) continue;
    const object = await env.ORDER_FILES.get(key);
    if (!object) continue;
    const bytes = await object.arrayBuffer();
    attachmentBytes += bytes.byteLength;
    if (attachmentBytes > MAX_ATTACHMENT_BYTES) return { sent: false, reason: "attachments_too_large" };
    attachments.push({
      content: arrayBufferToBase64(bytes),
      filename: String(file.filename || "order.xlsx"),
      type: XLSX_MIME,
      disposition: "attachment",
    });
  }
  if (!attachments.length) return { sent: false, reason: "files_unavailable" };

  const to = parseEmailList(env.ORDER_EMAIL_TO || DEFAULT_TO);
  const cc = parseEmailList(env.ORDER_EMAIL_CC || DEFAULT_CC).filter((address) => !to.includes(address));
  if (!to.length) return { sent: false, reason: "recipient_missing" };

  const snapshot = await loadOrderSnapshot(env, payload, result);
  const areas = await buildAreaGroups(env, payload);
  const totals = areaTotals(areas);
  const reference = String(result?.customerReference || payload?.reference || "New order").trim();
  const company = String(snapshot.companyName || result?.companyName || payload?.customer || "Customer").trim();
  const submittedAt = formatSubmittedAt(snapshot.createdAt || new Date().toISOString());
  const contact = String(payload?.contact || snapshot.contact || "").trim();
  const placedBy = displayUsername(auth?.username);
  const orderUrl = safeHttpUrl(env.ORDER_PORTAL_URL || DEFAULT_PORTAL_URL, DEFAULT_PORTAL_URL);
  const logoUrl = DEFAULT_LOGO_URL;
  const order = {
    reference,
    company,
    debtorCode: snapshot.debtorCode || payload?.debtorCode || "—",
    placedBy,
    submittedAt,
    requiredDate: formatRequiredDate(payload?.requiredDate),
    timeSlot: timeSlotLabel(payload?.timeSlot),
    address: fullAddress(payload),
    contact: contact || "—",
    phone: payload?.mobile || snapshot.mobile || "—",
    deliveryType: deliveryTypeLabel(payload?.deliveryType),
    extras: Array.isArray(payload?.extras) && payload.extras.length ? payload.extras.join(", ") : "None",
    instructions: String(payload?.deliveryInstructions || payload?.instructions || "").trim() || "None",
    orderUrl,
    logoUrl,
  };

  const subject = buildSubject(payload);
  const text = buildText(order, areas, totals);
  const html = buildHtml(order, areas, totals);
  const message = {
    from: {
      address: String(env.ORDER_EMAIL_FROM || DEFAULT_FROM).trim(),
      name: "Bell Plaster Orders",
    },
    to: to.length === 1 ? to[0] : to,
    subject,
    reply_to: String(env.ORDER_EMAIL_REPLY_TO || DEFAULT_REPLY_TO).trim(),
    text,
    html,
    attachments,
  };
  if (cc.length) message.cc = cc;

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/email/sending/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    },
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success === false) {
    const details = Array.isArray(body?.errors)
      ? body.errors.map((error) => error?.message || error?.code).filter(Boolean).join("; ")
      : "";
    throw new Error(details || `Cloudflare Email Service returned ${response.status}.`);
  }

  return {
    sent: true,
    messageId: body?.result?.message_id || null,
    recipient: to.join(", "),
    cc,
    subject,
    provider: "cloudflare_rest",
  };
}

function buildText(order, areas, totals) {
  const showAreaLabels = shouldShowAreaLabels(areas);
  const products = areas.length
    ? areas.flatMap((area) => [
        "",
        ...(showAreaLabels ? [area.label] : []),
        ...area.lines.map((line) => `${line.description}\nSKU: ${line.sku || "—"} | Qty ${line.quantity}`),
      ])
    : ["", "No product lines were available in the email payload."];
  return [
    `${order.placedBy} placed order #${order.reference} on ${order.submittedAt}.`,
    "",
    `View order: ${order.orderUrl}`,
    "",
    "Order summary",
    ...products,
    "",
    `${totals.lineCount} product line${totals.lineCount === 1 ? "" : "s"}`,
    `${totals.unitCount} total units`,
    "",
    "Delivery details",
    `Customer: ${order.company}`,
    `Debtor code: ${order.debtorCode}`,
    `Required: ${order.requiredDate}`,
    `Time Slot: ${order.timeSlot}`,
    `Delivery: ${order.deliveryType}`,
    `Address: ${order.address}`,
    `Contact: ${order.contact}`,
    `Phone: ${order.phone}`,
    `Extras: ${order.extras}`,
    `Instructions: ${order.instructions}`,
    "",
    "Bell Plaster and Building Supplies",
    COMPANY_ADDRESS,
  ].join("\n");
}

function buildHtml(order, areas, totals) {
  const showAreaLabels = shouldShowAreaLabels(areas);
  const products = areas.length
    ? areas.map((area) => `
      ${showAreaLabels ? `
      <tr>
        <td style="padding:18px 0 8px;color:#5f6c68;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;">${escapeHtml(area.label)}</td>
      </tr>` : ""}
      ${area.lines.map((line) => `
      <tr>
        <td style="padding:0 0 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:0 12px 16px 0;border-bottom:1px solid #e5e9e7;vertical-align:top;">
                <div style="color:#202523;font-size:14px;font-weight:600;line-height:20px;">${escapeHtml(line.description)}</div>
                <div style="margin-top:3px;color:#7a8480;font-size:12px;line-height:18px;">SKU: ${escapeHtml(line.sku || "—")}</div>
              </td>
              <td width="72" align="right" style="width:72px;padding:0 0 16px;border-bottom:1px solid #e5e9e7;color:#202523;font-size:14px;font-weight:600;line-height:20px;vertical-align:top;white-space:nowrap;">Qty ${line.quantity}</td>
            </tr>
          </table>
        </td>
      </tr>`).join("")}`).join("")
    : '<tr><td style="padding:16px 0;color:#5f6c68;font-size:13px;">No product lines were available in the email payload.</td></tr>';

  const details = [
    ["Customer", order.company],
    ["Debtor code", order.debtorCode],
    ["Required", order.requiredDate],
    ["Time Slot", order.timeSlot],
    ["Delivery", order.deliveryType],
    ["Address", order.address],
    ["Contact", order.contact],
    ["Phone", order.phone],
    ["Extras", order.extras],
    ["Instructions", order.instructions],
  ].map(([label, value]) => `
    <tr>
      <td width="110" style="width:110px;padding:5px 12px 5px 0;color:#7a8480;font-size:12px;line-height:18px;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:5px 0;color:#202523;font-size:13px;line-height:18px;vertical-align:top;">${escapeHtml(value)}</td>
    </tr>`).join("");

  return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Bell Plaster order</title>
</head>
<body style="margin:0;padding:0;background:#f3f5f4;color:#202523;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#f3f5f4;">
    <tr>
      <td align="center" style="padding:32px 16px 24px;">
        <table role="presentation" width="540" cellpadding="0" cellspacing="0" style="width:100%;max-width:540px;border-collapse:separate;background:#ffffff;border:1px solid #cfd5d2;border-radius:8px;overflow:hidden;">
          <tr><td style="height:6px;background:#a62b47;font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td style="padding:24px 24px 20px;">
              <p style="margin:0;color:#202523;font-size:15px;line-height:23px;"><strong>${escapeHtml(order.placedBy)}</strong> placed order <strong>#${escapeHtml(order.reference)}</strong> on ${escapeHtml(order.submittedAt)}.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:18px;">
                <tr>
                  <td align="left">
                    <!--[if mso]>
                    <v:roundrect href="${escapeHtml(order.orderUrl)}" style="height:40px;v-text-anchor:middle;width:96px;" arcsize="10%" stroke="f" fillcolor="#006557">
                      <w:anchorlock xmlns:w="urn:schemas-microsoft-com:office:word"/>
                      <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">View order</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-- -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
                      <tr>
                        <td width="96" height="40" align="center" valign="middle" bgcolor="#006557" style="width:96px;height:40px;background:#006557;border-radius:5px;text-align:center;vertical-align:middle;">
                          <a href="${escapeHtml(order.orderUrl)}" style="display:block;width:96px;height:40px;color:#ffffff;font-size:14px;font-weight:600;line-height:40px;text-align:center;text-decoration:none;border-radius:5px;-webkit-text-size-adjust:none;">View order</a>
                        </td>
                      </tr>
                    </table>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px;"><div style="height:1px;background:#dfe4e2;font-size:0;line-height:0;">&nbsp;</div></td>
          </tr>
          <tr>
            <td style="padding:22px 24px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="padding:0 0 16px;">
                    <h1 style="margin:0;color:#202523;font-size:18px;font-weight:650;line-height:24px;">Order summary</h1>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">${products}</table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:2px;">
                <tr>
                  <td height="48" valign="middle" style="height:48px;padding:0;color:#202523;font-size:15px;font-weight:650;line-height:21px;vertical-align:middle;">${totals.lineCount} product line${totals.lineCount === 1 ? "" : "s"}</td>
                  <td height="48" valign="middle" align="right" style="height:48px;padding:0;color:#202523;font-size:15px;font-weight:650;line-height:21px;vertical-align:middle;">${totals.unitCount} total units</td>
                </tr>
                <tr>
                  <td colspan="2" height="1" bgcolor="#dfe4e2" style="height:1px;background:#dfe4e2;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px 24px;">
              <h2 style="margin:0 0 8px;color:#202523;font-size:15px;font-weight:650;line-height:21px;">Delivery details</h2>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">${details}</table>
            </td>
          </tr>
        </table>
        <table role="presentation" width="540" cellpadding="0" cellspacing="0" style="width:100%;max-width:540px;border-collapse:collapse;">
          <tr>
            <td align="center" style="padding:28px 16px 8px;">
              <img src="${escapeHtml(order.logoUrl)}" width="178" alt="Bell Plaster and Building Supplies" style="display:block;width:178px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;">
              <p style="margin:12px 0 0;color:#7a8480;font-size:12px;line-height:18px;">${escapeHtml(COMPANY_ADDRESS)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function loadOrderSnapshot(env, payload, result) {
  const fallback = {
    debtorCode: payload?.debtorCode || "",
    companyName: result?.companyName || payload?.customer || "",
    contact: payload?.contact || "",
    mobile: payload?.mobile || "",
    createdAt: "",
  };
  const submissionId = String(result?.submissionId || payload?.submissionId || "").trim();
  if (!submissionId || !env?.DB?.prepare) return fallback;
  try {
    const row = await env.DB.prepare(
      `SELECT debtor_code_snapshot, company_name_snapshot, contact_snapshot, mobile_snapshot, created_at
       FROM orders WHERE submission_id = ? LIMIT 1`,
    ).bind(submissionId).first();
    return row ? {
      debtorCode: row.debtor_code_snapshot || fallback.debtorCode,
      companyName: row.company_name_snapshot || fallback.companyName,
      contact: row.contact_snapshot || fallback.contact,
      mobile: row.mobile_snapshot || fallback.mobile,
      createdAt: row.created_at || fallback.createdAt,
    } : fallback;
  } catch (error) {
    console.warn("Order email snapshot lookup failed.", error);
    return fallback;
  }
}

async function buildAreaGroups(env, payload) {
  const floors = payload?.floors && typeof payload.floors === "object" ? payload.floors : {};
  const floorEntries = Object.entries(floors);
  const singleLabel = floorEntries.length === 1
    ? String(floorEntries[0][1]?.label || floorEntries[0][0] || "").trim()
    : "";
  const showAreaLabels = floorEntries.length !== 1 || singleLabel !== "Tab 1";
  const groups = floorEntries.map(([key, area], index) => {
    const lines = [];
    for (const item of Array.isArray(area?.items) ? area.items : []) {
      const product = PRODUCT_CATALOG[String(item?.key || "").trim()] || {};
      addLine(lines, item?.sku || product.sku, item?.description || item?.name || product.description || product.label || item?.key, item?.quantity);
    }
    for (const item of Array.isArray(area?.otherMaterials) ? area.otherMaterials : []) {
      addLine(lines, item?.sku, item?.description || item?.name, item?.quantity);
    }
    return {
      label: String(area?.label || key || `Tab ${index + 1}`).trim(),
      lines: combineLines(lines),
      showLabel: showAreaLabels,
    };
  }).filter((group) => group.lines.length);
  await enrichMissingDescriptions(env, groups);
  return groups;
}

function addLine(lines, rawSku, rawDescription, rawQuantity) {
  const quantity = Number(rawQuantity || 0);
  if (!Number.isInteger(quantity) || quantity <= 0) return;
  const sku = String(rawSku || "").trim().toUpperCase();
  const description = String(rawDescription || "").trim() || sku || "Product";
  lines.push({ sku, description, quantity });
}

function combineLines(lines) {
  const combined = new Map();
  for (const line of lines) {
    const key = line.sku || line.description.toUpperCase();
    const current = combined.get(key) || { ...line, quantity: 0 };
    current.quantity += line.quantity;
    if ((!current.description || current.description === current.sku) && line.description) current.description = line.description;
    combined.set(key, current);
  }
  return [...combined.values()];
}

async function enrichMissingDescriptions(env, groups) {
  if (!env?.DB?.prepare) return;
  const missing = [...new Set(groups.flatMap((group) => group.lines)
    .filter((line) => line.sku && line.description.toUpperCase() === line.sku)
    .map((line) => line.sku))];
  if (!missing.length) return;
  const descriptions = new Map();
  try {
    for (let start = 0; start < missing.length; start += 50) {
      const chunk = missing.slice(start, start + 50);
      const result = await env.DB.prepare(
        `SELECT sku, description_raw FROM products WHERE sku COLLATE NOCASE IN (${chunk.map(() => "?").join(", ")})`,
      ).bind(...chunk).all();
      for (const product of result.results || []) {
        descriptions.set(String(product.sku || "").trim().toUpperCase(), String(product.description_raw || "").trim());
      }
    }
  } catch (error) {
    console.warn("Order email product descriptions could not be enriched.", error);
    return;
  }
  groups.forEach((group) => group.lines.forEach((line) => {
    if (descriptions.get(line.sku)) line.description = descriptions.get(line.sku);
  }));
}

function areaTotals(areas) {
  return areas.reduce((total, area) => ({
    lineCount: total.lineCount + area.lines.length,
    unitCount: total.unitCount + area.lines.reduce((sum, line) => sum + line.quantity, 0),
  }), { lineCount: 0, unitCount: 0 });
}

function buildSubject(payload) {
  const date = formatRequiredDate(payload?.requiredDate);
  const slot = timeSlotLabel(payload?.timeSlot);
  return isPickup(payload?.deliveryType)
    ? cleanSubject(`[Portal Order] ${slot} Pickup on ${date}`)
    : cleanSubject(`[Portal Order] ${slot} Delivery to ${subjectAddress(payload)} on ${date}`);
}

function subjectAddress(payload) {
  const street = titleCase(payload?.addressLine1 || payload?.siteAddress1 || extractStreet(payload?.deliveryAddress));
  const suburb = titleCase(extractSuburb(payload?.addressLine2 || payload?.siteAddress2 || payload?.deliveryAddress));
  return [street, suburb].filter(Boolean).join(", ") || "delivery address";
}

function fullAddress(payload) {
  if (isPickup(payload?.deliveryType)) return "Customer pickup";
  return String(payload?.deliveryAddress || "").trim()
    || [payload?.addressLine1, payload?.addressLine2].map((value) => String(value || "").trim()).filter(Boolean).join(", ")
    || "—";
}

function extractStreet(value) {
  return String(value || "").trim().split(",")[0].trim();
}

function extractSuburb(value) {
  const text = String(value || "")
    .replace(/,?\s*Australia\s*$/i, "")
    .replace(/\b(?:VIC|VICTORIA)\b\s*(?:3\d{3}|8\d{3})?\b.*$/i, "")
    .trim();
  const parts = text.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.at(-1) || text;
}

function formatRequiredDate(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return text || "unspecified date";
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))));
}

function formatSubmittedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "—");
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function timeSlotLabel(value) {
  return ({ "1ST": "1st Load", "2ND": "2nd Load", AM: "AM", PM: "PM", ANY: "Anytime" })[String(value || "").trim().toUpperCase()]
    || String(value || "Anytime");
}

function deliveryTypeLabel(value) {
  return ({
    "Pickup (Customer to collect)": "Customer Pickup",
    "Manual Unload (Knauf Labour)": "Hand Unload",
    "Mechanical (Forklift/Crane/Own)": "Forklift Delivery",
    "Mixed Unload (Hand + Machine)": "Delivery (No Assistance)",
  })[String(value || "")] || String(value || "—");
}

function isPickup(value) {
  return /pickup|pick\s*up|collect/i.test(String(value || ""));
}

function shouldShowAreaLabels(areas) {
  return areas.some((area) => area.showLabel);
}

function displayUsername(value) {
  const text = String(value || "").trim();
  if (!text) return "Portal user";
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function titleCase(value) {
  return String(value || "").trim().toLowerCase().replace(/\b([a-z])/g, (match) => match.toUpperCase());
}

function safeHttpUrl(value, fallback) {
  const text = String(value || "").trim();
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

function cleanSubject(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
}

function parseEmailList(value) {
  return [...new Set(String(value || "").split(/[;,\n]+/).map((address) => address.trim().toLowerCase()).filter(Boolean))];
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}
