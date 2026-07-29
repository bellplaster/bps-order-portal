import { PRODUCT_CATALOG } from "./catalog.js";

const CATALOG_KEY_BY_SKU = new Map(
  Object.entries(PRODUCT_CATALOG)
    .map(([key, product]) => [normaliseSku(product?.sku), key])
    .filter(([sku]) => Boolean(sku)),
);

export async function reconcileStandardProductItems(env, payload) {
  const floors = payload?.floors;
  if (!floors || typeof floors !== "object" || Array.isArray(floors)) return payload;

  for (const [areaKey, area] of Object.entries(floors)) {
    if (!area || typeof area !== "object") continue;

    const retainedItems = [];
    const sourceItems = [];

    for (const item of Array.isArray(area.items) ? area.items : []) {
      const key = String(item?.key || "").trim();
      const sku = normaliseSku(item?.sku);

      // Prefer the live SKU submitted by the browser. The frontend catalogue
      // can be newer than the legacy static PRODUCT_CATALOG key map.
      if (sku) {
        const canonicalKey = CATALOG_KEY_BY_SKU.get(sku);
        if (canonicalKey) {
          retainedItems.push({ ...item, key: canonicalKey, sku });
          continue;
        }

        if (sku.length > 80 || !/^[A-Z0-9._/-]+$/.test(sku)) {
          throw clientError(`${areaLabel(area, areaKey)}: invalid stock code "${sku}".`);
        }

        sourceItems.push({ sku, quantity: item?.quantity });
        continue;
      }

      // Legacy drafts may contain only the internal key. Continue supporting
      // them when that key still exists in the static catalogue.
      if (key && PRODUCT_CATALOG[key]) {
        retainedItems.push(item);
        continue;
      }

      throw clientError(`${areaLabel(area, areaKey)}: Unknown product key "${key || "missing"}".`);
    }

    if (sourceItems.length) {
      await requireActiveAccriviaSkus(env, sourceItems.map((item) => item.sku), areaLabel(area, areaKey));
    }

    area.items = retainedItems;
    area.otherMaterials = [
      ...(Array.isArray(area.otherMaterials) ? area.otherMaterials : []),
      ...sourceItems,
    ];
  }

  return payload;
}

async function requireActiveAccriviaSkus(env, skus, label) {
  if (!env?.DB) throw new Error("Missing Cloudflare binding: DB");

  const uniqueSkus = [...new Set(skus)];
  const found = new Set();

  for (let start = 0; start < uniqueSkus.length; start += 50) {
    const chunk = uniqueSkus.slice(start, start + 50);
    const placeholders = chunk.map(() => "?").join(", ");
    const result = await env.DB.prepare(
      `SELECT sku FROM products
       WHERE active = 1 AND sku COLLATE NOCASE IN (${placeholders})`,
    ).bind(...chunk).all();

    for (const product of result.results || []) {
      found.add(normaliseSku(product?.sku));
    }
  }

  const missing = uniqueSkus.filter((sku) => !found.has(sku));
  if (missing.length) {
    throw clientError(
      `${label}: unknown or inactive Accrivia stock code${missing.length === 1 ? "" : "s"}: ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? "…" : ""}.`,
    );
  }
}

function areaLabel(area, fallback) {
  return String(area?.label || fallback || "Delivery area").trim();
}

function normaliseSku(value) {
  return String(value || "").trim().toUpperCase();
}

function clientError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}
