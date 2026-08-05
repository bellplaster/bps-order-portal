import test from "node:test";
import assert from "node:assert/strict";

import {
  prepareOrderEmailFiles,
  prepareOrderFileForDownload,
  prepareOrderFilesForViewer,
} from "../functions/_shared/order-email-attachments.js";

const historicalFiles = [
  {
    floor: "combined-old",
    filename: "BPS-11686-OLD.xlsx",
    r2Key: "orders/BPS-11686-OLD.xlsx",
  },
  {
    floor: "combined-new",
    filename: "BPS-11686-NEW.xlsx",
    r2Key: "orders/BPS-11686-NEW.xlsx",
  },
];

const currentFiles = [
  {
    floor: "combined-new",
    filename: "BPS-11686.xlsx",
    r2Key: "orders/BPS-11686.xlsx",
  },
];

test("customer service email receives only the site-area workbook", () => {
  assert.deepEqual(prepareOrderEmailFiles(historicalFiles), [
    {
      floor: "combined-new",
      filename: "BPS-11686.xlsx",
      floorLabel: "Accrivia order file",
      floor_label: "Accrivia order file",
      r2Key: "orders/BPS-11686-NEW.xlsx",
    },
  ]);
});

test("admin email follows the same single-workbook policy", () => {
  assert.deepEqual(
    prepareOrderEmailFiles(historicalFiles, { isAdmin: true }),
    prepareOrderEmailFiles(historicalFiles),
  );
});

test("current generated workbook keeps its production filename", () => {
  assert.deepEqual(prepareOrderFilesForViewer(currentFiles), [
    {
      floor: "combined-new",
      filename: "BPS-11686.xlsx",
      floorLabel: "Accrivia order file",
      floor_label: "Accrivia order file",
      r2Key: "orders/BPS-11686.xlsx",
    },
  ]);
});

test("direct downloads reject old-format files for every viewer", () => {
  assert.equal(
    prepareOrderFileForDownload({ floor: "combined-old", filename: "BELL-PLASTER-6-OLD.xlsx" }),
    null,
  );
  assert.equal(
    prepareOrderFileForDownload(
      { floor: "combined-old", filename: "BELL-PLASTER-6-OLD.xlsx" },
      { isAdmin: true },
    ),
    null,
  );
});

test("direct downloads expose the site-area workbook without NEW or V2 naming", () => {
  assert.equal(
    prepareOrderFileForDownload({ floor: "combined-new", filename: "BELL-PLASTER-6-NEW.xlsx" })?.filename,
    "BELL-PLASTER-6.xlsx",
  );
  assert.equal(
    prepareOrderFileForDownload(
      { floor: "combined-new", filename: "BELL-PLASTER-6-NEW.xlsx" },
      { isAdmin: true },
    )?.filename,
    "BELL-PLASTER-6.xlsx",
  );
});

test("attachment policy does not mutate stored file metadata", () => {
  const original = structuredClone(historicalFiles);
  prepareOrderEmailFiles(historicalFiles, { isAdmin: true });
  assert.deepEqual(historicalFiles, original);
});
