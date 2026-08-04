import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const script = await readFile(new URL("../public/account-interaction-polish.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../public/account-interaction-polish.css", import.meta.url), "utf8");
const accountPage = await readFile(new URL("../public/account/index.html", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

test("Account sidebar links use explicit offset scrolling", () => {
  assert.match(script, /document\.addEventListener\("click", handleAccountNavigation, true\)/);
  assert.match(script, /window\.scrollTo\(\{/);
  assert.match(script, /getBoundingClientRect\(\)\.top - accountHeaderOffset\(\)/);
  assert.match(script, /event\.stopImmediatePropagation\(\)/);
});

test("saved-address feedback is a local auto-dismissing toast", () => {
  assert.match(script, /\["Saved address added\.", "Address saved"\]/);
  assert.match(script, /MutationObserver/);
  assert.match(script, /root\.setAttribute\("aria-live"/);
  assert.match(script, /toastTimer = window\.setTimeout/);
  assert.match(styles, /#accountMessage:not\(\[hidden\]\) \{/);
  assert.match(styles, /position: fixed !important/);
  assert.match(styles, /bottom: max\(20px, env\(safe-area-inset-bottom\)\)/);
});

test("saved-address default checkbox is reset to a native compact control", () => {
  assert.match(styles, /saved-address-default input\[type="checkbox"\]/);
  assert.match(styles, /appearance: auto !important/);
  assert.match(styles, /width: 18px !important/);
  assert.match(styles, /height: 18px !important/);
  assert.match(styles, /padding: 0 !important/);
  assert.match(styles, /box-shadow: none !important/);
});

test("Account interaction assets are loaded and syntax checked", () => {
  assert.match(accountPage, /account-interaction-polish\.css\?v=20260804-2/);
  assert.match(accountPage, /account-interaction-polish\.js\?v=20260804-2/);
  assert.match(packageJson.scripts.check, /node --check public\/account-interaction-polish\.js/);
});


test("Account navigation uses aligned lightweight inline SVG icons", () => {
  assert.match(script, /const navIcons = \{/);
  assert.match(script, /profile:[\s\S]*viewBox="0 0 11 16"/);
  assert.match(script, /defaults:[\s\S]*viewBox="0 0 11 16"/);
  assert.match(script, /contacts:[\s\S]*viewBox="0 0 24 24"/);
  assert.match(script, /addresses:[\s\S]*viewBox="0 0 24 24"/);
  assert.match(script, /security:[\s\S]*viewBox="0 0 24 24"/);
  assert.match(script, /fill="currentColor"/);
  assert.match(script, /scheduleNavIcons/);
  assert.match(styles, /account-nav-v2 a::before/);
  assert.match(styles, /content: none !important/);
  assert.match(styles, /account-nav-icon svg/);
  assert.match(styles, /width: 15px/);
});
