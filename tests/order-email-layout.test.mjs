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
    "[Portal Order] Anytime Delivery to 125 Sussex St, Pascoe Vale on 1 December 2026",
  );
  assert.match(requestBody.html, /New web portal order/);
  assert.match(requestBody.html, /Abby<\/strong> placed order <strong>#42<\/strong>/);
  assert.doesNotMatch(requestBody.html, /Douglas<\/strong> placed order/);
  assert.match(requestBody.html, />View order<\/a>/);
  assert.match(requestBody.html, />Order summary<\/h1>/);
  assert.match(requestBody.html, /SHEETROCK ONE 10 mm 1350 x 6000/);
  assert.match(requestBody.html, /SKU: 10SR1360/);
  assert.match(requestBody.html, /Qty 10/);
  assert.doesNotMatch(requestBody.html, />Tab 1<\/td>/i);
  assert.doesNotMatch(requestBody.text, /\nTab 1\n/);
  assert.match(requestBody.html, /font-size:15px;font-weight:650;line-height:21px;">1 product line/);
  assert.match(requestBody.html, /font-size:15px;font-weight:650;line-height:21px;">10 total units/);
  assert.match(requestBody.html, /bell_logo_black\.png/);
  assert.match(requestBody.html, /125 Sussex Street, Pascoe Vale VIC 3044/);
  assert.match(requestBody.html, /max-width:540px/);
  assert.match(requestBody.text, /Abby placed order #42/);
  assert.match(requestBody.text, /SKU: 10SR1360 \| Qty 10/);
  assert.match(requestBody.text, /Required: 1 December 2026 · Anytime/);
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
    "[Portal Order] 1st Load Delivery to 125 Sussex St, Pascoe Vale on 1 December 2026",
  );
  assert.match(requestBody.html, /Mohamed<\/strong> placed order/);
  assert.match(requestBody.html, />Tab 1<\/td>/i);
  assert.match(requestBody.html, />Level 2<\/td>/i);
  assert.match(requestBody.text, /\nTab 1\n/);
  assert.match(requestBody.text, /\nLevel 2\n/);
});
