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

      // Matrix mappings are authoritative for standard products. When the
      // browser submits a SKU, preserve it for XLSX generation even when the
      // searchable D1 catalogue has not yet been refreshed.
      if (sku) {
        if (sku.length > 80 || !/^[A-Z0-9._/-]+$/.test(sku)) {
          throw clientError(`${areaLabel(area, areaKey)}: invalid stock code "${sku}".`);
        }

        const canonicalKey = CATALOG_KEY_BY_SKU.get(sku);
        if (canonicalKey) {
          retainedItems.push({ ...item, key: canonicalKey, sku });
        } else {
          sourceItems.push({
            sku,
            description: String(item?.description || item?.name || "").trim(),
            quantity: item?.quantity,
          });
        }
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
