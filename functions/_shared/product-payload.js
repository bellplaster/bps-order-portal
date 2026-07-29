import { PRODUCT_CATALOG } from "./catalog.js";

const CATALOG_KEY_BY_SKU = new Map(
  Object.entries(PRODUCT_CATALOG)
    .map(([key, product]) => [normaliseSku(product?.sku), key])
    .filter(([sku]) => Boolean(sku)),
);

export async function reconcileStandardProductItems(_env, payload) {
  const floors = payload?.floors;
  if (!floors || typeof floors !== "object" || Array.isArray(floors)) return payload;

  for (const [areaKey, area] of Object.entries(floors)) {
    if (!area || typeof area !== "object") continue;

    const retainedItems = [];
    const sourceItems = [];

    for (const item of Array.isArray(area.items) ? area.items : []) {
      const key = String(item?.key || "").trim();
      const sku = normaliseSku(item?.sku);

      // A valid matrix key is authoritative. Keep it as a standard product even
      // when the searchable Accrivia/D1 catalogue does not currently contain
      // the same SKU. orders-v2 will export the SKU and description from the
      // static matrix catalogue directly into the XLSX.
      if (key && PRODUCT_CATALOG[key]) {
        retainedItems.push({ ...item, key });
        continue;
      }

      // Some newer/legacy browser drafts may submit a generated source key.
      // Resolve those back to the canonical matrix key by SKU where possible.
      if (sku) {
        if (sku.length > 80 || !/^[A-Z0-9._/-]+$/.test(sku)) {
          throw clientError(`${areaLabel(area, areaKey)}: invalid stock code "${sku}".`);
        }

        const canonicalKey = CATALOG_KEY_BY_SKU.get(sku);
        if (canonicalKey) {
          retainedItems.push({ ...item, key: canonicalKey, sku });
        } else {
          // Only truly non-matrix products fall back to Additional Products.
          sourceItems.push({
            sku,
            description: String(item?.description || item?.name || "").trim(),
            quantity: item?.quantity,
          });
        }
        continue;
      }

      throw clientError(`${areaLabel(area, areaKey)}: Unknown product key "${key || "missing"}".`);
    }

    area.items = retainedItems;
    area.otherMaterials = [
      ...(Array.isArray(area.otherMaterials) ? area.otherMaterials : []),
      ...sourceItems,
    ];
  }

  return payload;
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
