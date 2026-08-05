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

test("products use named delivery tabs inside one rounded compact line-item table", async () => {
  const [script, styles] = await Promise.all([
    read("public/orders/view/order-view.js"),
    read("public/orders/view/order-view.css"),
  ]);

  assert.match(script, /role", "tablist"/);
  assert.match(script, /role", "tabpanel"/);
  assert.match(script, /return `Tab \$\{index \+ 1\}`/);
  assert.match(script, /function renderAreaTable/);
  assert.match(script, /order-lines-shell/);
  assert.match(script, /order-line-section-row/);
  assert.doesNotMatch(script, /document\.createElement\("details"\)/);
  assert.doesNotMatch(script, /renderProductSection/);
  assert.match(styles, /\.order-lines-shell\s*\{[\s\S]*border-radius:\s*12px/);
  assert.match(styles, /\.order-lines-table tbody td\s*\{[\s\S]*height:\s*46px/);
  assert.match(styles, /\.order-line-section-row th\s*\{[\s\S]*height:\s*27px/);
});

test("order details use a tight main-and-sidebar layout without an activity panel", async () => {
  const [html, script, styles] = await Promise.all([
    read("public/orders/view/index.html"),
    read("public/orders/view/order-view.js"),
    read("public/orders/view/order-view.css"),
  ]);

  assert.match(html, /class="order-detail-layout"/);
  assert.match(html, /class="order-sidebar"/);
  assert.match(html, /id="orderDeliveryAddress"/);
  assert.match(html, /id="orderFulfilmentSummary"/);
  assert.match(html, /id="orderInstructionsBlock"/);
  assert.doesNotMatch(html, /id="orderTimeline"|>Activity</);
  assert.doesNotMatch(script, /function renderTimeline/);
  assert.match(script, /function renderDeliveryAddress/);
  assert.match(script, /function deliveryAddressParts/);
  assert.match(script, /google\.com\/maps\/search/);
  assert.match(styles, /\.order-detail-layout\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*300px/);
  assert.match(styles, /\.order-sidebar\s*\{[\s\S]*gap:\s*14px/);
  assert.match(styles, /\.order-fulfilment-summary\s*\{[\s\S]*border-radius:\s*12px/);
});

test("all viewers can print a dedicated order-page layout", async () => {
  const [html, script, styles] = await Promise.all([
    read("public/orders/view/index.html"),
    read("public/orders/view/order-view.js"),
    read("public/orders/view/order-view.css"),
  ]);

  assert.match(html, /id="printOrderButton"/);
  assert.match(script, /printOrderButton\.addEventListener\("click", \(\) => window\.print\(\)\)/);
  assert.match(script, /order-print-area-title/);
  assert.match(styles, /@media print/);
  assert.match(styles, /\.order-area-panel\[hidden\][\s\S]*display:\s*block\s*!important/);
  assert.match(styles, /\.order-area-tabs[\s\S]*display:\s*none\s*!important/);
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
  assert.match(html, /id="orderFilesCard"/);
});

test("order detail cache keys reference the revised presentation assets", async () => {
  const html = await read("public/orders/view/index.html");
  assert.match(html, /order-view\.css\?v=20260805-3/);
  assert.match(html, /order-view\.js\?v=20260805-3/);
});
