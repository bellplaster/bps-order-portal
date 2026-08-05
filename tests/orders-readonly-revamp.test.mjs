import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createOrderViewSnapshot,
  resolveOrderViewSnapshot,
  snapshotToOrderPayload,
  summariseOrderPayload,
} from "../functions/_shared/order-view-model.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const sampleLayout = {
  boards: {
    rows: [{ label: "6000", cells: ["board_sheetrockone_1350x6000"] }],
  },
};

const samplePayload = {
  reference: "11634",
  customer: "Bell Plaster",
  contact: "Douglas",
  mobile: "0481 188 188",
  requiredDate: "2026-08-26",
  timeSlot: "ANY",
  deliveryType: "Manual Unload (Knauf Labour)",
  deliveryAddress: "125 Sussex Street, Pascoe Vale VIC 3044",
  floors: {
    ground: {
      label: "Ground Floor",
      items: [{ key: "board_sheetrockone_1350x6000", quantity: 3 }],
      otherMaterials: [{ sku: "CUSTOM-1", description: "Custom item", quantity: 2 }],
      otherProducts: "Keep dry",
    },
  },
};

test("canonical snapshots freeze submitted layout and product presentation", () => {
  const snapshot = createOrderViewSnapshot({
    payload: samplePayload,
    layout: sampleLayout,
    capturedAt: "2026-08-05T09:18:00Z",
  });

  assert.equal(snapshot.schemaVersion, 1);
  assert.deepEqual(snapshot.layout, sampleLayout);
  assert.notEqual(snapshot.layout, sampleLayout, "layout must be cloned rather than referenced");
  assert.equal(snapshot.details.timeSlot, "ANY");
  assert.equal(snapshot.areas[0].label, "Ground Floor");
  assert.equal(snapshot.areas[0].items[0].sku, "10SR1360");
  assert.match(snapshot.areas[0].items[0].label, /Sheetrock One/i);
  assert.deepEqual(snapshot.totals, { areaCount: 1, lineCount: 2, unitCount: 5 });
});

test("the renderer payload is derived from the same canonical snapshot", () => {
  const snapshot = createOrderViewSnapshot({ payload: samplePayload, layout: sampleLayout });
  const payload = snapshotToOrderPayload(snapshot);

  assert.equal(payload.reference, "11634");
  assert.equal(payload.timeSlot, "ANY");
  assert.deepEqual(payload.floors.ground.items, [
    { key: "board_sheetrockone_1350x6000", quantity: 3 },
  ]);
  assert.deepEqual(payload.floors.ground.otherMaterials, [
    { sku: "CUSTOM-1", description: "Custom item", quantity: 2 },
  ]);
});

test("legacy orders are deterministic and explicitly identified as current-layout views", () => {
  const snapshot = resolveOrderViewSnapshot(samplePayload, { created_at: "2026-08-05T09:18:00Z" });
  assert.equal(snapshot.layoutSource, "current");
  assert.equal(snapshot.capturedAt, "2026-08-05T09:18:00Z");
  assert.equal(snapshot.totals.unitCount, 5);
  assert.deepEqual(summariseOrderPayload(samplePayload), snapshot.totals);
});

test("new submissions store immutable views separately from operational payloads", async () => {
  const submit = await read("functions/api/submit.js");
  assert.match(submit, /CREATE TABLE IF NOT EXISTS order_view_snapshots/);
  assert.match(submit, /INSERT OR REPLACE INTO order_view_snapshots/);
  assert.match(submit, /createOrderViewSnapshot/);
  assert.doesNotMatch(submit, /storedPayload\.viewSnapshot\s*=/);
  assert.doesNotMatch(submit, /UPDATE orders[\s\S]*SET payload_json = \?/);
});

test("order details are access controlled and GET remains read-only", async () => {
  const endpoint = await read("functions/api/orders/[submissionId].js");
  assert.match(endpoint, /export async function onRequestGet/);
  assert.match(endpoint, /canViewOrder\(viewer, order\)/);
  assert.match(endpoint, /loadStoredSnapshot/);
  assert.match(endpoint, /snapshotToOrderPayload/);
  assert.match(endpoint, /export async function onRequestPut[\s\S]*readOnlyResponse/);
  assert.match(endpoint, /DELETE FROM order_view_snapshots/);
});

test("Orders index is a compact navigable table rather than repeated cards", async () => {
  const [html, script, styles] = await Promise.all([
    read("public/orders/index.html"),
    read("public/orders/orders.js"),
    read("public/orders/orders.css"),
  ]);

  assert.match(html, /<table class="orders-table">/);
  assert.match(html, /id="ordersSearch"/);
  assert.match(html, /id="ordersPageLabel"/);
  assert.match(script, /const PAGE_SIZE = 25/);
  assert.match(script, /\/orders\/view\/\?id=/);
  assert.match(script, /row\.addEventListener\("keydown"/);
  assert.doesNotMatch(script, /renderOrderCard/);
  assert.match(styles, /\.orders-table td\{height:70px/);
});

test("dedicated order details expose summary, products, files and read-only grid", async () => {
  const [html, script] = await Promise.all([
    read("public/orders/view/index.html"),
    read("public/orders/view/order-view.js"),
  ]);

  assert.match(html, /id="orderSummaryDetails"/);
  assert.match(html, /id="orderAreas"/);
  assert.match(html, /id="orderFiles"/);
  assert.match(script, /fetchOrder\(submissionId\)/);
  assert.match(script, /\?viewOrder=/);
  assert.match(script, /groupAreaLines/);
});

test("read-only grid reuses the production renderer and blocks mutations", async () => {
  const [script, styles, sourceTruth, bridge, index] = await Promise.all([
    read("public/order-readonly-mode.js"),
    read("public/order-readonly-mode.css"),
    read("public/source-truth-payload.js"),
    read("public/portal-state-bridge.js"),
    read("public/index.html"),
  ]);

  assert.match(script, /const originalLoadCatalog = loadCatalog/);
  assert.match(script, /state\.layout = snapshot\.layout/);
  assert.match(script, /applyPayload\(result\.payload\)/);
  assert.match(script, /control\.disabled = true/);
  assert.match(script, /button\.matches\("\[data-floor-tab\]"\)/);
  assert.match(styles, /\.order-readonly-page #orderForm input:disabled/);
  assert.match(sourceTruth, /if \(globalThis\.BPS_ORDER_READONLY\) return originalApplyPayload\(next\)/);
  assert.match(bridge, /has\("viewOrder"\)\) return/);
  assert.match(index, /order-readonly-mode\.js\?v=20260805-1/);
});

test("the duplicate history drawer and editable submitted-order path are retired", async () => {
  const [index, app, orderController, loader, packageJson] = await Promise.all([
    read("public/index.html"),
    read("public/app.js"),
    read("public/app-order.js"),
    read("public/draft-restore-fix.js"),
    read("package.json"),
  ]);

  assert.doesNotMatch(index, /historyDrawer|openHistoryButton|viewHistoryButton/);
  assert.doesNotMatch(app, /loadOrderHistory|openHistory|closeHistory/);
  assert.doesNotMatch(orderController, /function editOrder|function renderHistoryOrder|function loadOrderHistory/);
  assert.doesNotMatch(loader, /orders-navigation/);
  assert.doesNotMatch(packageJson, /public\/orders-navigation\.js/);
  assert.match(orderController, /fetchJson\("\/api\/submit"/);
});
