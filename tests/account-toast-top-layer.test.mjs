import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Account notifications use the browser top layer", async () => {
  const source = await read("public/account-interaction-polish.js");

  assert.match(source, /setAttribute\("popover", "manual"\)/);
  assert.match(source, /root\.showPopover\(\)/);
  assert.match(source, /root\.hidePopover\(\)/);
  assert.match(source, /root\.matches\(":popover-open"\)/);
});

test("top-layer Account notifications retain their bottom-right placement", async () => {
  const styles = await read("public/account-interaction-polish.css");

  assert.match(styles, /#accountMessage\[popover\]:not\(\[hidden\]\)/);
  assert.match(styles, /top:\s*auto\s*!important/);
  assert.match(styles, /left:\s*auto\s*!important/);
  assert.match(styles, /#accountMessage\[popover\]::backdrop/);
});
