import { json, safeExcerpt } from "../_shared/responses.js";

const DEFAULT_FROM = "portal@orders.bellplaster.com.au";
const DEFAULT_TO = "marketing@bellplaster.com.au";
const DEFAULT_REPLY_TO = "info@bellplaster.com.au";

export async function onRequestPost(context) {
  const auth = context.data?.auth;
  if (!auth?.userId) return json({ ok: false, error: "Authentication required." }, 401);
  if (auth.role !== "admin") return json({ ok: false, error: "Administrator access required." }, 403);

  const accountId = String(context.env?.CLOUDFLARE_ACCOUNT_ID || "").trim();
  const token = String(context.env?.CLOUDFLARE_EMAIL_API_TOKEN || "").trim();
  if (!accountId || !token) {
    return json({
      ok: false,
      error: "Email sending is not configured for this deployment.",
      reason: "not_configured",
    }, 503);
  }

  const recipients = parseEmailList(context.env.ORDER_EMAIL_TO || DEFAULT_TO);
  if (!recipients.length) {
    return json({
      ok: false,
      error: "No internal order-email recipient is configured.",
      reason: "recipient_missing",
    }, 503);
  }

  const sentAt = new Date().toISOString();
  const sender = String(context.env.ORDER_EMAIL_FROM || DEFAULT_FROM).trim();
  const replyTo = String(context.env.ORDER_EMAIL_REPLY_TO || DEFAULT_REPLY_TO).trim();
  const subject = `Bell Plaster portal email test — ${sentAt}`;
  const message = {
    from: {
      address: sender,
      name: "Bell Plaster Orders",
    },
    to: recipients.length === 1 ? recipients[0] : recipients,
    subject,
    reply_to: replyTo,
    text: [
      "Bell Plaster order portal email delivery test.",
      "",
      "The production Cloudflare Email Sending configuration is working.",
      `Requested by: ${auth.username || "Administrator"}`,
      `Sent at: ${sentAt}`,
      "",
      "No customer order was created and no Accrivia file was generated.",
    ].join("\n"),
    html: buildHtml(auth.username || "Administrator", sentAt),
  };

  let response;
  try {
    response = await fetch(
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
  } catch (error) {
    return json({
      ok: false,
      error: "Cloudflare Email Sending could not be reached.",
      reason: "provider_unreachable",
      detail: safeExcerpt(error?.message || String(error), 240),
    }, 502);
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success === false) {
    const providerError = Array.isArray(body?.errors)
      ? body.errors.map((error) => error?.message || error?.code).filter(Boolean).join("; ")
      : "";
    return json({
      ok: false,
      error: "Cloudflare rejected the test email.",
      reason: "provider_rejected",
      providerStatus: response.status,
      detail: safeExcerpt(providerError || `Cloudflare returned ${response.status}.`, 300),
    }, 502);
  }

  return json({
    ok: true,
    sent: true,
    recipient: recipients.join(", "),
    subject,
    messageId: body?.result?.message_id || null,
    provider: "cloudflare_rest",
  });
}

export function parseEmailList(value) {
  return [...new Set(
    String(value || "")
      .split(/[;,\n]/)
      .map((address) => address.trim().toLowerCase())
      .filter((address) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)),
  )];
}

function buildHtml(username, sentAt) {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f4f6f5;font-family:Arial,sans-serif;color:#17211f;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f5;padding:28px 12px;">
      <tr><td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #d9dfdd;border-radius:12px;overflow:hidden;">
          <tr><td style="background:#ad2948;color:#ffffff;padding:16px 20px;font-size:16px;font-weight:700;">Bell Plaster order portal</td></tr>
          <tr><td style="padding:24px 20px;">
            <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;">Email delivery test successful</h1>
            <p style="margin:0 0 16px;font-size:14px;line-height:1.55;">This message was sent through the production Cloudflare Email Sending configuration.</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:13px;">
              <tr><th align="left" style="padding:8px 0;border-bottom:1px solid #e2e7e5;color:#66736f;">Requested by</th><td align="right" style="padding:8px 0;border-bottom:1px solid #e2e7e5;">${escapeHtml(username)}</td></tr>
              <tr><th align="left" style="padding:8px 0;color:#66736f;">Sent at</th><td align="right" style="padding:8px 0;">${escapeHtml(sentAt)}</td></tr>
            </table>
            <p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#66736f;">No customer order was created and no Accrivia file was generated.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
