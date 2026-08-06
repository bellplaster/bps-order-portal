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

test("production export writes tab names in column A and NOTES in the stock code column", () => {
  const workbook = createAccriviaSiteAreaXlsx({
    ...common,
    productRows: [
      ["TAB 1", "10SR1260", "", 1],
      ["", "NOTES", "TIME SLOT: 1ST; DELIVERY TYPE: HAND UNLOAD", 1],
    ],
  });
  const xml = workbookText(workbook);

  assert.match(xml, /<c r="A12"[^>]*t="inlineStr"><is><t xml:space="preserve">TAB 1<\/t><\/is><\/c>/);
  assert.match(xml, /<c r="A13"[^>]*\/>/);
  assert.match(xml, /<c r="B13"[^>]*t="inlineStr"><is><t xml:space="preserve">NOTES<\/t><\/is><\/c>/);
  assert.match(xml, /<c r="C13"[^>]*t="inlineStr">/);
  assert.match(xml, /<c r="D13"[^>]*><v>1<\/v><\/c>/);
});

test("production export uses the approved A-C and D column widths", () => {
  const xml = workbookText(createAccriviaSiteAreaXlsx({
    ...common,
    productRows: [["TAB 1", "10SR1260", "", 1]],
  }));

  assert.match(xml, /<col min="1" max="3" width="20" customWidth="1"\/><col min="4" max="4" width="10" customWidth="1"\/>/);
});

test("production export includes the approved pretty workbook styling", () => {
  const xml = workbookText(createAccriviaSiteAreaXlsx({
    ...common,
    productRows: [
      ["TAB 1", "10SR1260", "", 1],
      ["", "10SR1360", "", 2],
      ["", "NOTES", "TIME SLOT: AM", 1],
    ],
  }));

  assert.match(xml, /<name val="Arial"\/>/);
  assert.match(xml, /<name val="Consolas"\/>/);
  assert.match(xml, /fgColor rgb="FFA62B45"/);
  assert.match(xml, /fgColor rgb="FFF1F3F2"/);
  assert.match(xml, /fgColor rgb="FFFFF7DC"/);
  assert.match(xml, /bottom style="medium"><color rgb="FF9DA5A2"/);
  assert.match(xml, /<row r="13"[^>]*thickBot="1"/);
});
