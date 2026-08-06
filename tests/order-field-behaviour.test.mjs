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
    getElementById() { return null; },
  };
  vm.runInNewContext(source, {
    window,
    document,
    WeakMap,
    Map,
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
    ["+61393881669", "+61 3 9388 1669"],
  ]);

  for (const [input, expected] of examples) {
    assert.equal(rules.formatAustralianPhone(input), expected);
    assert.equal(rules.isValidAustralianPhone(expected), true);
    assert.equal(normaliseAustralianPhone(input), expected);
  }
});

test("loaded defaults are naturalised without forcing deliberately mixed case", () => {
  const rules = browserRules();
  assert.equal(rules.formatLoadedValue("DOUGLAS PHUNG", "person", "words"), "Douglas Phung");
  assert.equal(
    rules.formatLoadedValue("125 SUSSEX STREET, PASCOE VALE VIC 3044", "street", "words"),
    "125 Sussex Street, Pascoe Vale VIC 3044",
  );
  assert.equal(
    rules.formatLoadedValue("CONTACT ME WHEN ARRIVING", "instructions", "sentence"),
    "Contact me when arriving",
  );
  assert.equal(rules.formatLoadedValue("McDonald site", "reference", "sentence"), "McDonald site");
});

test("capitalisation is an initial suggestion and respects later manual edits", () => {
  const rules = browserRules();
  assert.equal(rules.suggestCapitalisation("douglas phung", "words"), "Douglas Phung");
  assert.equal(rules.suggestCapitalisation("125 sussex street", "words"), "125 Sussex Street");
  assert.equal(rules.suggestCapitalisation("monday deliver", "sentence"), "Monday deliver");
  assert.equal(rules.suggestCapitalisation("contact me when arriving", "sentence"), "Contact me when arriving");

  assert.match(source, /inputType\.startsWith\("delete"\)[\s\S]*assistanceEnabled = false/);
  assert.match(source, /hasSelection[\s\S]*assistanceEnabled = false/);
  assert.match(source, /editingEarlierText[\s\S]*assistanceEnabled = false/);
  assert.doesNotMatch(source, /\.toUpperCase\(\)/);
});

test("shared behaviour loads before all order application scripts", () => {
  const shared = indexHtml.search(/\/order-field-behaviour\.js\?v=\d{8}-\d+/);
  const app = indexHtml.indexOf("/app.js?");
  const details = indexHtml.indexOf("/order-detail-fields.js?");
  const legacyUtility = indexHtml.indexOf("/phone-date-refinement.js?");
  assert.ok(shared > -1);
  assert.ok(app > shared);
  assert.ok(details > shared);
  assert.ok(legacyUtility > shared);
  assert.match(indexHtml, /order-field-behaviour\.css\?v=20260806-1/);
});

test("references are optional for customers but retain natural text and symbols", () => {
  assert.match(source, /field\.removeAttribute\("pattern"\)/);
  assert.match(source, /field\.maxLength = 80/);
  assert.doesNotMatch(indexHtml, /id="reference"[^>]*pattern=/);
  assert.match(indexHtml, /id="reference"[^>]*maxlength="80"/);
  assert.match(indexHtml, /id="reference"[^>]*placeholder="Reference \(optional\)"/);
  assert.doesNotMatch(indexHtml, /id="reference"[^>]*\srequired(?:\s|>)/);
  assert.match(submitSource, /function cleanOrderReference/);
  assert.doesNotMatch(submitSource, /\^\\d\+\(\?:-\\d\+\)\*\$/);
  assert.match(submitSource, /payload\.reference = reference/);
  assert.match(submitSource, /payload\.customerReference = reference/);
});
