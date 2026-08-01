import test from "node:test";
import assert from "node:assert/strict";

import { onRequestPost, parseEmailList } from "../functions/api/admin-email-test.js";

const CONFIGURED_ENV = {
  CLOUDFLARE_ACCOUNT_ID: "account-123",
  CLOUDFLARE_EMAIL_API_TOKEN: "secret-token",
  ORDER_EMAIL_FROM: "portal@orders.bellplaster.com.au",
  ORDER_EMAIL_TO: "marketing@bellplaster.com.au",
  ORDER_EMAIL_REPLY_TO: "info@bellplaster.com.au",
};

test("parseEmailList normalises, validates and de-duplicates recipients", () => {
  assert.deepEqual(
    parseEmailList(" Marketing@BellPlaster.com.au;invalid;marketing@bellplaster.com.au\ninfo@bellplaster.com.au "),
    ["marketing@bellplaster.com.au", "info@bellplaster.com.au"],
  );
});

test("email test endpoint rejects non-administrators without contacting Cloudflare", async () => {
  const originalFetch = globalThis.fetch;
  let providerCalled = false;
  globalThis.fetch = async () => {
    providerCalled = true;
    throw new Error("Provider should not be called");
  };

  try {
    const response = await onRequestPost({
      data: { auth: { userId: 22, username: "customer", role: "customer" } },
      env: CONFIGURED_ENV,
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.ok, false);
    assert.equal(body.error, "Administrator access required.");
    assert.equal(providerCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("email test endpoint reports the exact missing deployment bindings", async () => {
  const originalFetch = globalThis.fetch;
  let providerCalled = false;
  globalThis.fetch = async () => {
    providerCalled = true;
    throw new Error("Provider should not be called");
  };

  try {
    const response = await onRequestPost({
      data: { auth: { userId: 1, username: "admin", role: "admin" } },
      env: {
        ORDER_EMAIL_TO: "marketing@bellplaster.com.au",
      },
    });
    const body = await response.json();

    assert.equal(response.status, 503);
    assert.equal(body.ok, false);
    assert.equal(body.reason, "not_configured");
    assert.deepEqual(body.missingBindings, [
      "CLOUDFLARE_ACCOUNT_ID",
      "CLOUDFLARE_EMAIL_API_TOKEN",
    ]);
    assert.equal(
      body.detail,
      "Missing production bindings: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_EMAIL_API_TOKEN.",
    );
    assert.equal(providerCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("email test endpoint sends one message to the configured internal recipient", async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = "";
  let requestOptions = null;

  globalThis.fetch = async (url, options) => {
    requestUrl = String(url);
    requestOptions = options;
    return new Response(JSON.stringify({
      success: true,
      result: { message_id: "test-message-123" },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const response = await onRequestPost({
      data: { auth: { userId: 1, username: "admin", role: "admin" } },
      env: CONFIGURED_ENV,
    });
    const body = await response.json();
    const providerMessage = JSON.parse(requestOptions.body);

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.sent, true);
    assert.equal(body.messageId, "test-message-123");
    assert.equal(body.recipient, "marketing@bellplaster.com.au");
    assert.match(requestUrl, /accounts\/account-123\/email\/sending\/send$/);
    assert.equal(requestOptions.method, "POST");
    assert.equal(requestOptions.headers.Authorization, "Bearer secret-token");
    assert.equal(providerMessage.to, "marketing@bellplaster.com.au");
    assert.equal(providerMessage.from.address, "portal@orders.bellplaster.com.au");
    assert.equal(providerMessage.reply_to, "info@bellplaster.com.au");
    assert.match(providerMessage.text, /No customer order was created/);
    assert.equal(providerMessage.attachments, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("email test endpoint exposes a safe provider rejection without reporting success", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    success: false,
    errors: [{ code: 1001, message: "Sender is not authorised" }],
  }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });

  try {
    const response = await onRequestPost({
      data: { auth: { userId: 1, username: "admin", role: "admin" } },
      env: CONFIGURED_ENV,
    });
    const body = await response.json();

    assert.equal(response.status, 502);
    assert.equal(body.ok, false);
    assert.equal(body.reason, "provider_rejected");
    assert.equal(body.providerStatus, 403);
    assert.equal(body.detail, "Sender is not authorised");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
