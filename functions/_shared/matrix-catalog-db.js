export function createMatrixAwareDb(db, payload) {
  if (!db || typeof db.prepare !== "function") return db;

  const trusted = collectTrustedMatrixProducts(payload);
  if (!trusted.size) return db;

  return new Proxy(db, {
    get(target, property, receiver) {
      if (property !== "prepare") return Reflect.get(target, property, receiver);

      return function prepareMatrixAwareStatement(sql) {
        const statement = target.prepare(sql);
        if (!isActiveProductLookup(sql)) return statement;
        return wrapProductLookup(statement, trusted);
      };
    },
  });
}

function collectTrustedMatrixProducts(payload) {
  const products = new Map();
  for (const area of Object.values(payload?.floors || {})) {
    for (const item of Array.isArray(area?.otherMaterials) ? area.otherMaterials : []) {
      if (item?.matrixSource !== true) continue;
      const sku = normaliseSku(item?.sku);
      if (!sku) continue;
      products.set(sku, {
        sku,
        description_raw: String(item?.description || item?.name || sku).trim() || sku,
      });
    }
  }
  return products;
}

function isActiveProductLookup(sql) {
  const text = String(sql || "").replace(/\s+/g, " ").toUpperCase();
  return text.includes("SELECT SKU, DESCRIPTION_RAW FROM PRODUCTS")
    && text.includes("ACTIVE = 1")
    && text.includes("SKU COLLATE NOCASE IN");
}

function wrapProductLookup(statement, trusted) {
  let boundValues = [];

  return new Proxy(statement, {
    get(target, property, receiver) {
      if (property === "bind") {
        return (...values) => {
          boundValues = values;
          const bound = target.bind(...values);
          return wrapBoundProductLookup(bound, trusted, boundValues);
        };
      }
      return Reflect.get(target, property, receiver);
    },
  });
}

function wrapBoundProductLookup(statement, trusted, boundValues) {
  return new Proxy(statement, {
    get(target, property, receiver) {
      if (property === "all") {
        return async (...args) => {
          const response = await target.all(...args);
          return appendTrustedProducts(response, trusted, boundValues);
        };
      }
      return Reflect.get(target, property, receiver);
    },
  });
}

function appendTrustedProducts(response, trusted, requestedValues) {
  const results = [...(Array.isArray(response?.results) ? response.results : [])];
  const present = new Set(results.map((row) => normaliseSku(row?.sku)).filter(Boolean));

  for (const value of requestedValues) {
    const sku = normaliseSku(value);
    const product = trusted.get(sku);
    if (!product || present.has(sku)) continue;
    results.push(product);
    present.add(sku);
  }

  return { ...(response || {}), results };
}

function normaliseSku(value) {
  return String(value || "").trim().toUpperCase();
}
