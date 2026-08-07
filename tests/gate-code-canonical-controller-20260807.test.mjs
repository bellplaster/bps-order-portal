import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("canonical delivery controller creates Gate Code and N/A controls", async () => {
  const delivery = await read("public/delivery-refinement.js");

  assert.match(delivery, /const gateControl = createGateCodeControl\(\)/);
  assert.match(delivery, /controlRow\.append\(timeSelect\.wrapper, deliverySelect\.wrapper, extrasControl\.wrapper, gateControl\.wrapper\)/);
  assert.match(delivery, /input\.id = "gateCode"/);
  assert.match(delivery, /na\.id = "gateCodeNotApplicable"/);
  assert.match(delivery, /\^\\d\{4,6\}\$/);
  assert.match(delivery, /window\.BPSGateCode = Object\.freeze/);
});

test("Gate Code is part of the canonical order lifecycle", async () => {
  const order = await read("public/app-order.js");

  assert.match(order, /window\.BPSGateCode\?\.validate\?\.\(\)/);
  assert.match(order, /Enter a 4–6 digit gate code or select N\/A\./);
  assert.match(order, /gateCode: window\.BPSGateCode\?\.value\?\.\(\) \|\| ""/);
  assert.match(order, /window\.BPSGateCode\?\.setValue\?\.\(payload\.gateCode \|\| ""\)/);
  assert.match(order, /\["Gate code", payload\.gateCode \|\| "—"\]/);
});

test("Gate Code uses the existing Order Details grid rather than a patch script", async () => {
  const css = await read("public/order-control-refinement.css");
  const index = await read("public/index.html");

  assert.match(css, /\.order-form-page \.gate-code-control \{\s*display: contents !important;/);
  assert.match(css, /112px minmax\(110px, \.55fr\)\s*minmax\(62px, auto\)/);
  assert.doesNotMatch(index, /gate-code\.js/);
});
