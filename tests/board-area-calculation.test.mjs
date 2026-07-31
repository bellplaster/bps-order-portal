import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../public/order-form-enhancements.js", import.meta.url), "utf8");
const context = vm.createContext({ console });
vm.runInContext(source, context, { filename: "order-form-enhancements.js" });
const math = context.BpsBoardAreaMath;

function closeTo(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `Expected ${actual} to equal ${expected}`);
}

test("board area controller exposes one authoritative calculation API", () => {
  assert.ok(math);
  assert.equal(typeof math.calculateBoardColumnArea, "function");
  assert.equal(typeof math.calculateBoardSummary, "function");
  assert.equal(typeof math.formatArea, "function");
});

test("two 1200 x 3000 boards calculate to 7.2 square metres", () => {
  const area = math.calculateBoardColumnArea(1200, [{ lengthMm: 3000, quantity: 2 }]);
  closeTo(area, 7.2);
  assert.equal(math.formatArea(area), "7.2");
});

test("column and grand totals include multiple rows and widths", () => {
  const result = math.calculateBoardSummary(
    [1200, 1350],
    [
      { lengthMm: 3000, quantities: [2, 1] },
      { lengthMm: 2400, quantities: [3, 4] },
    ],
  );

  closeTo(result.columnTotals[0], 15.84);
  closeTo(result.columnTotals[1], 17.01);
  closeTo(result.grandTotal, 32.85);
  assert.equal(math.formatArea(result.grandTotal), "32.85");
});

test("invalid, zero and negative quantities do not change totals", () => {
  const result = math.calculateBoardSummary(
    [1200],
    [
      { lengthMm: 3000, quantities: ["not-a-number"] },
      { lengthMm: 3000, quantities: [0] },
      { lengthMm: 3000, quantities: [-2] },
      { lengthMm: 3000, quantities: [1] },
    ],
  );

  closeTo(result.grandTotal, 3.6);
});

test("comma-formatted large quantities remain accurate", () => {
  const area = math.calculateBoardColumnArea("1,200", [{ lengthMm: "6,000", quantity: "10,000" }]);
  closeTo(area, 72000);
  assert.equal(math.formatArea(area), "72000");
});

test("formatting rounds to two decimals without unnecessary trailing zeros", () => {
  assert.equal(math.formatArea(5), "5");
  assert.equal(math.formatArea(5.7), "5.7");
  assert.equal(math.formatArea(5.678), "5.68");
});