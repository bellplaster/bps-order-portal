import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../public/gate-code.js", import.meta.url), "utf8");
const loader = fs.readFileSync(new URL("../public/reference-placeholder.js", import.meta.url), "utf8");

test("gate code control is loaded by the order form", () => {
  assert.match(loader, /gate-code\.js\?v=/);
  assert.match(loader, /data-gate-code-control/);
});

test("gate code requires four to six digits or N\/A", () => {
  assert.match(source, /\^\\d\{4,6\}\$/);
  assert.match(source, /Enter a 4–6 digit gate code or select N\/A\./);
  assert.match(source, /gateCodeNotApplicable/);
});

test("gate code is stored in the order payload", () => {
  assert.match(source, /gateCode:\s*gateCodeValue\(\)/);
  assert.match(source, /payload\?\.gateCode/);
});

test("delivery controls use four equal columns", () => {
  assert.match(source, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)!important/);
});
