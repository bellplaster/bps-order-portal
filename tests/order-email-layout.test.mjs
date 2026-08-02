import test from "node:test";
import assert from "node:assert/strict";
import { sendOrderFilesEmail } from "../functions/_shared/order-email.js";

const baseEnvironment = {
  CLOUDFLARE_ACCOUNT_ID: "account",
  CLOUDFLARE_EMAIL_API_TOKEN: "token",
  ORDER_EMAIL_TO: "marketing@bellplaster.com.au",
  ORDER_PORTAL_URL: "https://orders.bellplaster.com.au/",
  ORDER_FILES: {
    get: async () => ({
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    }),
  },
};

const basePayload = {
  reference: "42",
  customer: "BPS",
  debtorCode: "BPS BRUNSW17",
  contact: "DOUGLAS",
  mobile: "0481 188 188",
  requiredDate: "2026-12-01",
  timeSlot: "ANY",
  deliveryAddress: "125 SUSSEX ST, PASCOE VALE VIC 3044",
  deliveryType: "Manual Unload (Knauf Labour)",
};

const generatedResult = {
  customerReference: "42",
  companyName: "BPS",
  generatedFiles: [{ r2Key: "orders/42.xlsx", filename: "42.xlsx" }],
};

test("order email uses the authenticated username, omits the lone default tab, and keeps the XLSX attachment", async (context) => {
  const originalFetch = globalThis.fetch;
  let requestBody;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ success: true, result: { message_id: "message-1" } }),
    };
  };

  const result = await sendOrderFilesEmail(baseEnvironment, {
    ...basePayload,
    floors: {
      floor1: {
        label: "Tab 1",
        items: [{ sku: "10SR1360", description: "SHEETROCK ONE 10 mm 1350 x 6000", quantity: 10 }],
        otherMaterials: [],
      },
    },
  }, generatedResult, { username: "abby" });

  assert.equal(result.sent, true);
  assert.equal(requestBody.attachments.length, 1);
  assert.equal(requestBody.attachments[0].filename, "42.xlsx");
  assert.equal(
    requestBody.subject,
    "[Portal Order] Delivery Anytime to 125 Sussex St, Pascoe Vale on 1 December 2026",
  );
  assert.doesNotMatch(requestBody.html, /New web portal order/i);
  assert.doesNotMatch(requestBody.text, /New web portal order/i);
  assert.match(requestBody.html, /Abby<\/strong> placed order <strong>#42<\/strong>/);
  assert.doesNotMatch(requestBody.html, /Douglas<\/strong> placed order/);
  assert.match(requestBody.html, />View order<\/a>/);
  assert.match(requestBody.html, /<v:roundrect[\s\S]*height:40px;v-text-anchor:middle;width:96px;/);
  assert.match(requestBody.html, /width="96" height="40"[\s\S]*background:#006557/);
  assert.match(requestBody.html, />Order summary<\/h1>/);
  assert.match(requestBody.html, /<tr><td height="16" style="height:16px;font-size:0;line-height:0;">&nbsp;<\/td><\/tr>/);
  assert.match(requestBody.html, /SHEETROCK ONE 10 mm 1350 x 6000/);
  assert.match(requestBody.html, /SKU: 10SR1360/);
  assert.match(requestBody.html, /Qty 10/);
  assert.doesNotMatch(requestBody.html, />Tab 1<\/td>/i);
  assert.doesNotMatch(requestBody.text, /\nTab 1\n/);
  assert.match(requestBody.html, /height:48px;padding:0;color:#202523;font-size:15px;font-weight:650;line-height:21px;vertical-align:middle;">1 product line/);
  assert.match(requestBody.html, /height:48px;padding:0;color:#202523;font-size:15px;font-weight:650;line-height:21px;vertical-align:middle;">10 total units/);
  assert.match(requestBody.html, /colspan="2" height="1" bgcolor="#dfe4e2"/);
  assert.doesNotMatch(requestBody.html, /border-top:1px solid #dfe4e2/);
  assert.match(requestBody.html, /https:\/\/bellplastersupplies\.com\.au\/cdn\/shop\/files\/bell_logo_black\.png\?v=1781229976/);
  assert.match(requestBody.html, /125 Sussex Street, Pascoe Vale VIC 3044/);
  assert.match(requestBody.html, /max-width:540px/);
  assert.match(requestBody.html, />Required<\/td>[\s\S]*>1 December 2026<\/td>/);
  assert.match(requestBody.html, />Time Slot<\/td>[\s\S]*>Anytime<\/td>/);
  assert.doesNotMatch(requestBody.html, /Required[\s\S]*1 December 2026 · Anytime/);
  assert.doesNotMatch(requestBody.html, /combined Accrivia XLSX/i);
  assert.doesNotMatch(requestBody.text, /Accrivia XLSX file/i);
  assert.match(requestBody.text, /Abby placed order #42/);
  assert.match(requestBody.text, /SKU: 10SR1360 \| Qty 10/);
  assert.match(requestBody.text, /Required: 1 December 2026/);
  assert.match(requestBody.text, /Time Slot: Anytime/);
});

test("order email retains tab labels when multiple tabs contain products", async (context) => {
  const originalFetch = globalThis.fetch;
  let requestBody;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ success: true, result: { message_id: "message-2" } }),
    };
  };

  await sendOrderFilesEmail(baseEnvironment, {
    ...basePayload,
    timeSlot: "1ST",
    floors: {
      floor1: {
        label: "Tab 1",
        items: [{ sku: "10SR1360", description: "SHEETROCK ONE", quantity: 1 }],
        otherMaterials: [],
      },
      floor2: {
        label: "Level 2",
        items: [{ sku: "PS1A3536", description: "PS1A Internal Angle 135° - 3600 mm", quantity: 2 }],
        otherMaterials: [],
      },
    },
  }, generatedResult, { username: "mohamed" });

  assert.equal(
    requestBody.subject,
    "[Portal Order] Delivery 1st Load to 125 Sussex St, Pascoe Vale on 1 December 2026",
  );
  assert.match(requestBody.html, /Mohamed<\/strong> placed order/);
  assert.match(requestBody.html, />Tab 1<\/td>/i);
  assert.match(requestBody.html, />Level 2<\/td>/i);
  assert.match(requestBody.text, /\nTab 1\n/);
  assert.match(requestBody.text, /\nLevel 2\n/);
  assert.match(requestBody.html, />Time Slot<\/td>[\s\S]*>1st Load<\/td>/);
});
