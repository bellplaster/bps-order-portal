import test from "node:test";
import assert from "node:assert/strict";
import { sendOrderFilesEmail } from "../functions/_shared/order-email.js";

test("order email uses a human-readable summary and keeps the XLSX attachment", async (context) => {
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

  const result = await sendOrderFilesEmail({
    CLOUDFLARE_ACCOUNT_ID: "account",
    CLOUDFLARE_EMAIL_API_TOKEN: "token",
    ORDER_EMAIL_TO: "marketing@bellplaster.com.au",
    ORDER_PORTAL_URL: "https://orders.bellplaster.com.au/",
    ORDER_FILES: {
      get: async () => ({
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      }),
    },
  }, {
    reference: "42",
    customer: "BPS",
    debtorCode: "BPS BRUNSW17",
    contact: "DOUGLAS",
    mobile: "0481 188 188",
    requiredDate: "2026-12-01",
    timeSlot: "1ST",
    deliveryAddress: "125 SUSSEX ST, PASCOE VALE VIC 3044",
    deliveryType: "Manual Unload (Knauf Labour)",
    floors: {
      floor1: {
        label: "Tab 1",
        items: [{ sku: "10SR1360", description: "SHEETROCK ONE 10 mm 1350 x 6000", quantity: 10 }],
        otherMaterials: [],
      },
    },
  }, {
    customerReference: "42",
    companyName: "BPS",
    generatedFiles: [{ r2Key: "orders/42.xlsx", filename: "42.xlsx" }],
  }, { username: "admin" });

  assert.equal(result.sent, true);
  assert.equal(requestBody.attachments.length, 1);
  assert.equal(requestBody.attachments[0].filename, "42.xlsx");
  assert.match(requestBody.html, /Douglas<\/strong> placed order <strong>#42<\/strong>/);
  assert.match(requestBody.html, />View order<\/a>/);
  assert.match(requestBody.html, />Order summary<\/h1>/);
  assert.match(requestBody.html, /SHEETROCK ONE 10 mm 1350 x 6000/);
  assert.match(requestBody.html, /SKU: 10SR1360/);
  assert.match(requestBody.html, /Qty 10/);
  assert.match(requestBody.html, /max-width:540px/);
  assert.match(requestBody.text, /Douglas placed order #42/);
  assert.match(requestBody.text, /SKU: 10SR1360 \| Qty 10/);
});
