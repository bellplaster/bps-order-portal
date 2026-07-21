import fs from "node:fs";
import path from "node:path";

const inputPath = process.argv[2];
const outputPath = process.argv[3] || "data/products_import.sql";

if (!inputPath) {
  console.error("Usage: node tools/build-products-sql.mjs <Accrivia.csv> [output.sql]");
  process.exit(1);
}

const bytes = fs.readFileSync(inputPath);
const text = new TextDecoder("windows-1252").decode(bytes);
const rows = parseDelimited(text, ";");

if (rows.length < 2) {
  throw new Error("The CSV does not contain product rows.");
}

const header = rows[0].map((value) => String(value || "").trim());
const indexes = {
  warehouse: header.indexOf("Item / Warehouse"),
  available: header.indexOf("Available"),
  stockGroup: header.indexOf("Stock Group"),
  sku: header.indexOf("Stock Code"),
  description: header.indexOf("Description"),
};

if (indexes.sku < 0 || indexes.description < 0) {
  throw new Error("The CSV must contain Stock Code and Description columns.");
}

const products = new Map();

for (const row of rows.slice(1)) {
  const sku = clean(row[indexes.sku]).toUpperCase();
  const description = clean(row[indexes.description]);

  if (!sku || !description) continue;

  products.set(sku, {
    sku,
    description,
    descriptionSearch: normaliseSearch(description),
    searchCompact: compactSearch(`${sku} ${description}`),
    stockGroup: clean(row[indexes.stockGroup]),
    warehouse: clean(row[indexes.warehouse]),
    available: parseNullableNumber(row[indexes.available]),
  });
}

const importId = `sql-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}`;
const now = new Date().toISOString();
const statements = [];

statements.push("-- Generated from the Accrivia warehouse export.");
statements.push("-- Run migrations/0002_products.sql before this file.");
statements.push(`INSERT OR REPLACE INTO product_imports (import_id, source_name, row_count, status, started_at, completed_at) VALUES (${sql(importId)}, ${sql(path.basename(inputPath))}, ${products.size}, 'completed', ${sql(now)}, ${sql(now)});`);

for (const product of products.values()) {
  statements.push(
    `INSERT INTO products (sku, description_raw, description_search, search_compact, stock_group, warehouse, available, active, import_id, updated_at) VALUES (` +
    [
      sql(product.sku),
      sql(product.description),
      sql(product.descriptionSearch),
      sql(product.searchCompact),
      sql(product.stockGroup),
      sql(product.warehouse),
      product.available === null ? "NULL" : String(product.available),
      "1",
      sql(importId),
      sql(now),
    ].join(", ") +
    `) ON CONFLICT(sku) DO UPDATE SET description_raw=excluded.description_raw, description_search=excluded.description_search, search_compact=excluded.search_compact, stock_group=excluded.stock_group, warehouse=excluded.warehouse, available=excluded.available, active=1, import_id=excluded.import_id, updated_at=excluded.updated_at;`,
  );
}

statements.push(`UPDATE products SET active = 0, updated_at = ${sql(now)} WHERE COALESCE(import_id, '') <> ${sql(importId)};`);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, statements.join("\n") + "\n", "utf8");
console.log(`Wrote ${products.size} products to ${outputPath}`);

function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === delimiter) {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  return rows;
}

function normaliseSearch(value) {
  return String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[×*]/g, "x")
    .replace(/(\d)\s*x\s*(\d)/g, "$1 $2")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function compactSearch(value) {
  return normaliseSearch(value).replace(/\s+/g, "");
}

function clean(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function parseNullableNumber(value) {
  const cleaned = clean(value).replace(/,/g, "");
  if (!cleaned) return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function sql(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}
