import test from "node:test";
import assert from "node:assert/strict";

import {
  prepareOrderEmailFiles,
  prepareOrderFileForDownload,
  prepareOrderFilesForViewer,
} from "../functions/_shared/order-email-attachments.js";

const generatedFiles = [
  {
    filename: "BPS-11686-OLD.xlsx",
    r2Key: "orders/BPS-11686-OLD.xlsx",
  },
  {
    filename: "BPS-11686-NEW.xlsx",
    r2Key: "orders/BPS-11686-NEW.xlsx",
  },
];

test("customer service email receives only the legacy file without OLD in the filename", () => {
  const files = prepareOrderEmailFiles(generatedFiles);

  assert.deepEqual(files, [
    {
      filename: "BPS-11686.xlsx",
      floorLabel: "Accrivia order file",
      floor_label: "Accrivia order file",
      r2Key: "orders/BPS-11686-OLD.xlsx",
    },
  ]);
});

test("admin email receives both formats renamed V1 and V2", () => {
  const files = prepareOrderEmailFiles(generatedFiles, { isAdmin: true });

  assert.deepEqual(files, [
    {
      filename: "BPS-11686-V1.xlsx",
      floorLabel: "Accrivia format · V1",
      floor_label: "Accrivia format · V1",
      r2Key: "orders/BPS-11686-OLD.xlsx",
    },
    {
      filename: "BPS-11686-V2.xlsx",
      floorLabel: "Site area format · V2",
      floor_label: "Site area format · V2",
      r2Key: "orders/BPS-11686-NEW.xlsx",
    },
  ]);
});

test("customer confirmation and history receive only the production file", () => {
  const files = prepareOrderFilesForViewer([
    { floor: "combined-old", filename: "BELL-PLASTER-6-OLD.xlsx", id: 1 },
    { floor: "combined-new", filename: "BELL-PLASTER-6-NEW.xlsx", id: 2 },
  ]);

  assert.deepEqual(files, [
    {
      floor: "combined-old",
      filename: "BELL-PLASTER-6.xlsx",
      floorLabel: "Accrivia order file",
      floor_label: "Accrivia order file",
      id: 1,
    },
  ]);
});

test("admin downloads use V1 and V2 content-disposition names", () => {
  assert.equal(
    prepareOrderFileForDownload({ floor: "combined-old", filename: "BELL-PLASTER-6-OLD.xlsx" }, { isAdmin: true })?.filename,
    "BELL-PLASTER-6-V1.xlsx",
  );
  assert.equal(
    prepareOrderFileForDownload({ floor: "combined-new", filename: "BELL-PLASTER-6-NEW.xlsx" }, { isAdmin: true })?.filename,
    "BELL-PLASTER-6-V2.xlsx",
  );
});

test("admin viewer labels identify V1 and V2 without OLD or NEW wording", () => {
  const files = prepareOrderFilesForViewer(generatedFiles, { isAdmin: true });

  assert.deepEqual(files.map((file) => file.floorLabel), [
    "Accrivia format · V1",
    "Site area format · V2",
  ]);
});

test("non-admin direct download policy rejects the hidden V2 file", () => {
  assert.equal(
    prepareOrderFileForDownload({ floor: "combined-new", filename: "BELL-PLASTER-6-NEW.xlsx" }),
    null,
  );
});

test("attachment policy does not mutate stored file metadata", () => {
  const original = structuredClone(generatedFiles);

  prepareOrderEmailFiles(generatedFiles, { isAdmin: true });

  assert.deepEqual(generatedFiles, original);
});
