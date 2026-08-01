import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const wranglerConfig = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");

test("deployment declares the Cloudflare email API token as a required secret", () => {
  assert.match(
    wranglerConfig,
    /\[secrets\][\s\S]*?required\s*=\s*\[\s*["']CLOUDFLARE_EMAIL_API_TOKEN["']\s*\]/,
  );
});

test("the Cloudflare email API token is not committed as a plaintext variable", () => {
  const varsBlock = wranglerConfig.match(/\[vars\]([\s\S]*?)(?=\n\[[^\]]+\]|$)/)?.[1] || "";
  assert.doesNotMatch(varsBlock, /^\s*CLOUDFLARE_EMAIL_API_TOKEN\s*=/m);
});
