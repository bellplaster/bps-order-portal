import {
  writeFile,
} from "node:fs/promises";

import {
  PRODUCT_CATALOG,
} from "../functions/_shared/catalog.js";

import {
  createAccriviaXlsx,
} from "../functions/_shared/xlsx.js";

const common = {
  debtorCode: "BPS BRUNSW17",
  orderDate: "2026-07-15",
  addressLine1: "125 Sussex Street",
  addressLine2: "Pascoe Vale VIC 3044",
  addressLine3: "Marc 0414 459 047",
  salesRepCode: "",
};

const ground = createAccriviaXlsx({
  ...common,
  requiredDate: "2026-07-22",
  orderNumber: "BPS-CF-TEST-001",
  jobName: "Cloudflare Native Test - Ground Floor",
  productRows: [
    [
      PRODUCT_CATALOG.board_sheetrockone_1200x2400.sku,
      PRODUCT_CATALOG.board_sheetrockone_1200x2400.description,
      10,
      "",
    ],
    [
      PRODUCT_CATALOG.compound_basecote45.sku,
      PRODUCT_CATALOG.compound_basecote45.description,
      2,
      "",
    ],
  ],
});

const first = createAccriviaXlsx({
  ...common,
  requiredDate: "2026-07-23",
  orderNumber: "BPS-CF-TEST-001",
  jobName: "Cloudflare Native Test - 1st Floor",
  productRows: [
    [
      PRODUCT_CATALOG.board_13hd_1200x3000.sku,
      PRODUCT_CATALOG.board_13hd_1200x3000.description,
      8,
      "",
    ],
    [
      PRODUCT_CATALOG.partiwall_partiwallhsection_r25hs3055.sku,
      PRODUCT_CATALOG.partiwall_partiwallhsection_r25hs3055.description,
      3,
      "",
    ],
  ],
});

await writeFile(
  "/mnt/data/Cloudflare_Native_Test_GF.xlsx",
  ground.bytes,
);

await writeFile(
  "/mnt/data/Cloudflare_Native_Test_L1.xlsx",
  first.bytes,
);

console.log("Generated Cloudflare-native Accrivia test files.");
