import {
  getCatalogResponse,
} from "../_shared/orders.js";

function isRetired40mmNail(product) {
  return String(product?.section || "").trim().toLowerCase() === "nails"
    && /\b40\s*mm\b/i.test(`${product?.label || ""} ${product?.description || ""}`);
}

function removeRetired40mmNails(catalog) {
  const sourceNails = catalog?.layout?.sections?.nails;
  if (!sourceNails) return catalog;

  const keepIndexes = (sourceNails.columns || [])
    .map((column, index) => ({ column, index }))
    .filter(({ column }) => !/^40\s*mm$/i.test(String(column || "").trim()));

  const nails = {
    ...sourceNails,
    columns: keepIndexes.map(({ column }) => column),
    rows: (sourceNails.rows || []).map((row) => ({
      ...row,
      cells: keepIndexes.map(({ index }) => row?.cells?.[index] || null),
    })),
  };

  const products = Object.fromEntries(
    Object.entries(catalog.products || {}).filter(([, product]) => !isRetired40mmNail(product)),
  );

  return {
    ...catalog,
    productCount: Object.keys(products).length,
    products,
    layout: {
      ...catalog.layout,
      sections: {
        ...catalog.layout.sections,
        nails,
      },
    },
  };
}

export function onRequestGet() {
  return Response.json(
    removeRetired40mmNails(getCatalogResponse()),
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}
