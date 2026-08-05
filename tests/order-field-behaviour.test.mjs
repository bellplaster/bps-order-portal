import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import { normaliseAustralianPhone } from "../functions/_shared/phone.js";

const source = await readFile(new URL("../public/order-field-behaviour.js", import.meta.url), "utf8");
const indexHtml = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const submitSource = await readFile(new URL("../functions/api/submit.js", import.meta.url), "utf8");

function browserRules() {
  const window = {};
  const document = {
    readyState: "loading",
    addEventListener() {},
  };
  vm.runInNewContext(source, {
    window,
    document,
    WeakMap,
    String,
    RegExp,
  });
  return window.BPSOrderFieldRules;
}

test("common Australian phone numbers are formatted consistently", () => {
  const rules = browserRules();
  const examples = new Map([
    ["0412345678", "0412 345 678"],
    ["0393881669", "03 9388 1669"],
    ["135394", "13 53 94"],
    ["1300123456", "1300 123 456"],
    ["1800123456", "1800 123 456"],
    ["1900123456", "1900 123 456"],
    ["93881669", "9388 1669"],
    ["+61412345678", "+61 412 345 678"],
  ]);

  for (const [input, expected] of examples) {
    assert.equal(rules.formatAustralianPhone(input), expected);
    assert.equal(rules.isValidAustralianPhone(expected), true);
    assert.equal(normaliseAustralianPhone(input), expected);
  }
});

test("capitalisation is a suggestion rather than a permanent formatter", () => {
  const rules = browserRules();
  assert.equal(rules.suggestCapitalisation("douglas phung", "words"), "Douglas Phung");
  assert.equal(rules.suggestCapitalisation("125 sussex street", "words"), "125 Sussex Street");
  assert.equal(rules.suggestCapitalisation("monday deliver", "sentence"), "Monday deliver");
  assert.equal(rules.suggestCapitalisation("contact me when arriving", "sentence"), "Contact me when arriving");

  assert.match(source, /startsWith\("delete"\)[\s\S]*state\.disabled = true/);
  assert.match(source, /hasSelection[\s\S]*state\.disabled = true/);
  assert.doesNotMatch(source, /\.toUpperCase\(\)/);
});

test("order form loads shared behaviour before the legacy refinement", () => {
  const shared = indexHtml.indexOf("/order-field-behaviour.js?v=20260806-1");
  const legacy = indexHtml.indexOf("/phone-date-refinement.js");
  assert.ok(shared > -1);
  assert.ok(legacy > shared);
});

test("references remain required but may contain natural customer text and symbols", () => {
  assert.match(source, /field\.removeAttribute\("pattern"\)/);
  assert.match(source, /field\.maxLength = 80/);
  assert.match(submitSource, /function cleanOrderReference/);
  assert.doesNotMatch(submitSource, /\^\\d\+\(\?:-\\d\+\)\*\$/);
  assert.match(submitSource, /payload\.reference = reference/);
  assert.match(submitSource, /payload\.customerReference = reference/);
});
