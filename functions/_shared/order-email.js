const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAX_ATTACHMENT_BYTES = 4_500_000;

export async function sendOrderFilesEmail(env, payload, result) {
  if (!env?.ORDER_EMAIL?.send) return { sent: false, reason: "not_configured" };

  const generatedFiles = Array.isArray(result?.generatedFiles) ? result.generatedFiles : [];
  if (!generatedFiles.length) return { sent: false, reason: "no_files" };
  if (!env.ORDER_FILES?.get) return { sent: false, reason: "files_binding_missing" };

  const attachments = [];
  let attachmentBytes = 0;
  for (const file of generatedFiles) {
    const key = String(file?.r2Key || "").trim();
    if (!key) continue;
    const object = await env.ORDER_FILES.get(key);
    if (!object) continue;
    const content = await object.arrayBuffer();
    attachmentBytes += content.byteLength;
    if (attachmentBytes > MAX_ATTACHMENT_BYTES) {
      return { sent: false, reason: "attachments_too_large" };
    }
    attachments.push({
      content,
      filename: String(file.filename || "order.xlsx"),
      type: XLSX_MIME,
      disposition: "attachment",
    });
  }
  if (!attachments.length) return { sent: false, reason: "files_unavailable" };

  const to = String(env.ORDER_EMAIL_TO || "marketing@bellplaster.com.au").trim();
  const from = String(env.ORDER_EMAIL_FROM || "orders@bellplaster.com.au").trim();
  const reference = String(result?.customerReference || payload?.reference || "New order").trim();
  const company = String(result?.companyName || payload?.customer || "Customer").trim();
  const address = String(payload?.deliveryAddress || [payload?.addressLine1, payload?.addressLine2].filter(Boolean).join(", ") || "—").trim();
  const delivery = displayDeliveryType(payload?.deliveryType);
  const subject = `New Bell Plaster order — ${reference} — ${company}`;
  const rows = [
    ["Customer", company],
    ["Reference", reference],
    ["Contact", String(payload?.contact || "—")],
    ["Phone", String(payload?.mobile || "—")],
    ["Required date", String(payload?.requiredDate || "—")],
    ["Time slot", String(payload?.timeSlot || "—")],
    ["Delivery", delivery],
    ["Address", address],
    ["Tabs", generatedFiles.map((file) => file.floorLabel || file.floor).filter(Boolean).join(", ") || "—"],
  ];

  const text = [
    "A new Bell Plaster order has been submitted.",
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    `${attachments.length} Accrivia XLSX file${attachments.length === 1 ? " is" : "s are"} attached.`,
  ].join("\n");
  const htmlRows = rows.map(([label, value]) => `
    <tr>
      <th style="padding:7px 10px;text-align:left;border-bottom:1px solid #d9dfdd;color:#5f6c68;font-size:12px;font-weight:600;">${escapeHtml(label)}</th>
      <td style="padding:7px 10px;border-bottom:1px solid #d9dfdd;color:#17211f;font-size:12px;">${escapeHtml(value)}</td>
    </tr>`).join("");
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f7f6;font-family:Arial,sans-serif;color:#17211f;">
    <div style="max-width:680px;margin:0 auto;background:#fff;border:1px solid #d9dfdd;">
      <div style="padding:14px 18px;background:#a62b47;color:#fff;font-size:16px;font-weight:700;">New order received</div>
      <div style="padding:18px;">
        <p style="margin:0 0 14px;font-size:13px;">The Accrivia-ready XLSX file${attachments.length === 1 ? " is" : "s are"} attached.</p>
        <table role="presentation" style="width:100%;border-collapse:collapse;">${htmlRows}</table>
      </div>
    </div>
  </body></html>`;

  const response = await env.ORDER_EMAIL.send({
    to,
    from: { email: from, name: "Bell Plaster Orders" },
    replyTo: to,
    subject,
    text,
    html,
    attachments,
  });
  return { sent: true, messageId: response?.messageId || null, recipient: to };
}

function displayDeliveryType(value) {
  const labels = {
    "Pickup (Customer to collect)": "Customer Pickup",
    "Manual Unload (Knauf Labour)": "Hand Unload",
    "Mechanical (Forklift/Crane/Own)": "Forklift Delivery",
    "Mixed Unload (Hand + Machine)": "Delivery (No Assistance)",
    "Hand unload": "Hand Unload",
    Forklift: "Forklift Delivery",
    Crane: "Crane Delivery",
    "Delivery (No assistance)": "Delivery (No Assistance)",
  };
  return labels[String(value || "")] || String(value || "—");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}
