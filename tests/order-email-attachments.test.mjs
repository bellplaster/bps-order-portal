import test from "node:test";
import assert from "node:assert/strict";

import { prepareOrderEmailFiles } from "../functions/_shared/order-email-attachments.js";

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
      r2Key: "orders/BPS-11686-OLD.xlsx",
    },
  ]);
});

test("admin email receives both formats renamed V1 and V2", () => {
  const files = prepareOrderEmailFiles(generatedFiles, { isAdmin: true });

  assert.deepEqual(files, [
    {
      filename: "BPS-11686-V1.xlsx",
      r2Key: "orders/BPS-11686-OLD.xlsx",
    },
    {
      filename: "BPS-11686-V2.xlsx",
      r2Key: "orders/BPS-11686-NEW.xlsx",
    },
  ]);
});

test("attachment policy does not mutate stored file metadata", () => {
  const original = structuredClone(generatedFiles);

  prepareOrderEmailFiles(generatedFiles, { isAdmin: true });

  assert.deepEqual(generatedFiles, original);
});
