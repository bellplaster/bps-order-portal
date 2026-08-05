import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("order heading removes the duplicated company prefix and formats company identifiers", async () => {
  const script = await read("public/orders/view/order-view.js");

  assert.match(script, /`Submitted \$\{formatDateTime\(order\.createdAt\)\} by \$\{displayActorName/);
  assert.doesNotMatch(script, /order\.companyName \|\| "Customer"\} · Submitted/);
  assert.match(script, /function displayCompanyName[\s\S]*toLocaleUpperCase/);
  assert.match(script, /compact\.length > 0 && compact\.length <= 3/);
});

test("products use named delivery tabs and one compact line-item table", async () => {
  const [script, styles] = await Promise.all([
    read("public/orders/view/order-view.js"),
    read("public/orders/view/order-view.css"),
  ]);

  assert.match(script, /role", "tablist"/);
  assert.match(script, /role", "tabpanel"/);
  assert.match(script, /return `Tab \$\{index \+ 1\}`/);
  assert.match(script, /function renderAreaTable/);
  assert.match(script, /order-line-section-row/);
  assert.doesNotMatch(script, /document\.createElement\("details"\)/);
  assert.doesNotMatch(script, /renderProductSection/);
  assert.match(styles, /\.order-area-tabs\{/);
  assert.match(styles, /\.order-area-tab\[aria-selected=true\]/);
  assert.match(styles, /\.order-lines-table tbody td\{height:48px/);
  assert.match(styles, /\.order-line-section-row th\{height:30px/);
});

test("customer viewers do not receive or download Accrivia XLSX files", async () => {
  const [detailEndpoint, fileEndpoint, script, html] = await Promise.all([
    read("functions/api/orders/[submissionId].js"),
    read("functions/api/files/[id].js"),
    read("public/orders/view/order-view.js"),
    read("public/orders/view/index.html"),
  ]);

  assert.match(detailEndpoint, /if \(!isInternalRole\(viewer\.role\)\) return \[\]/);
  assert.match(fileEndpoint, /!isInternalRole\(effectiveViewer\.role\)/);
  assert.match(script, /viewerRole === "admin" \|\| viewerRole === "customer_service"/);
  assert.match(script, /elements\.orderFilesCard\.hidden = !internalViewer/);
  assert.match(script, /elements\.orderLowerGrid\.classList\.toggle\("is-single", !internalViewer\)/);
  assert.match(html, /id="orderFilesCard"/);
  assert.match(html, /id="orderLowerGrid"/);
});

test("order detail cache keys reference the revised presentation assets", async () => {
  const html = await read("public/orders/view/index.html");
  assert.match(html, /order-view\.css\?v=20260805-2/);
  assert.match(html, /order-view\.js\?v=20260805-2/);
});
