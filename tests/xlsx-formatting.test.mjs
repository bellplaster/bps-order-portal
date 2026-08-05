import test from "node:test";
import assert from "node:assert/strict";

import { createAccriviaSiteAreaXlsx } from "../functions/_shared/xlsx.js";

const common = {
  debtorCode: "STAFF",
  orderDate: "2026-08-04",
  requiredDate: "2026-12-01",
  orderNumber: "6",
  jobName: "BELL PLASTER",
  addressLine1: "125 SUSSEX ST",
  addressLine2: "PASCOE VALE VIC 3044",
  addressLine3: "DOUGLAS 0481 188 188",
  salesRepCode: "",
};

function workbookText(workbook) {
  return new TextDecoder().decode(workbook.bytes);
}

test("production export writes tab names in column A and styles the NOTES row green", () => {
  const workbook = createAccriviaSiteAreaXlsx({
    ...common,
    productRows: [
      ["TAB 1", "10SR1260", "", 1],
      ["", "NOTES", "TIME SLOT: 1ST; DELIVERY TYPE: HAND UNLOAD", 1],
    ],
  });
  const xml = workbookText(workbook);

  assert.match(xml, /<c r="A12" s="9" t="inlineStr"><is><t xml:space="preserve">TAB 1<\/t><\/is><\/c>/);
  assert.match(xml, /<c r="A13" s="9" t="inlineStr"><is><t xml:space="preserve">NOTES<\/t><\/is><\/c>/);
  assert.match(xml, /<c r="B13" s="7"\/>/);
  assert.match(xml, /<c r="C13" s="7" t="inlineStr">/);
  assert.match(xml, /<c r="D13" s="8"><v>1<\/v><\/c>/);
});

test("production export retains the approved A-B and C-D column widths", () => {
  const xml = workbookText(createAccriviaSiteAreaXlsx({
    ...common,
    productRows: [["TAB 1", "10SR1260", "", 1]],
  }));

  assert.match(xml, /<col min="1" max="2" width="20" customWidth="1"\/><col min="3" max="4" width="10" customWidth="1"\/>/);
});
