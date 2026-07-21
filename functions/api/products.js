export async function onRequestGet(context) {
  const requestId = crypto.randomUUID();

  try {
    if (!context.env.DB) {
      throw new Error("Missing Cloudflare binding: DB");
    }

    const query = String(new URL(context.request.url).searchParams.get("q") || "").trim();

    if (query) {
      const normalised = normaliseSearch(query);
      const compact = compactSearch(query);
      const sku = query.replace(/[^a-z0-9]/gi, "").toUpperCase();

      const result = await context.env.DB.prepare(
        `SELECT sku, description_raw, stock_group, warehouse, available
         FROM products
         WHERE active = 1
           AND (
             sku = ? COLLATE NOCASE
             OR sku LIKE ? COLLATE NOCASE
             OR search_compact LIKE ?
             OR description_search LIKE ?
           )
         ORDER BY
           CASE
             WHEN sku = ? COLLATE NOCASE THEN 0
             WHEN sku LIKE ? COLLATE NOCASE THEN 1
             WHEN search_compact LIKE ? THEN 2
             ELSE 3
           END,
           sku
         LIMIT 50`,
      )
        .bind(
          sku,
          `${sku}%`,
          `%${compact}%`,
          `%${normalised}%`,
          sku,
          `${sku}%`,
          `${compact}%`,
        )
        .all();

      return jsonResponse({
        ok: true,
        products: presentProducts(result.results || []),
        requestId,
      }, requestId, 200, "private, max-age=30");
    }

    const result = await context.env.DB.prepare(
      `SELECT sku, description_raw, stock_group, warehouse, available
       FROM products
       WHERE active = 1
       ORDER BY sku`,
    ).all();

    return jsonResponse({
      ok: true,
      products: presentProducts(result.results || []),
      count: Number(result.results?.length || 0),
      requestId,
    }, requestId, 200, "private, max-age=300");
  } catch (error) {
    const message = error?.message || String(error);
    const missingTable = /no such table:\s*products/i.test(message);

    return jsonResponse({
      ok: false,
      error: missingTable
        ? "The Accrivia product catalogue has not been imported yet. Open /catalog-admin/ and import the CSV."
        : message,
      requestId,
    }, requestId, missingTable ? 503 : 500, "no-store");
  }
}

function presentProducts(rows) {
  return rows.map((row) => ({
    sku: String(row.sku || ""),
    description: String(row.description_raw || ""),
    stockGroup: String(row.stock_group || ""),
    warehouse: String(row.warehouse || ""),
    available: row.available === null || row.available === undefined
      ? null
      : Number(row.available),
  }));
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

function jsonResponse(body, requestId, status, cacheControl) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": cacheControl,
      "X-Request-ID": requestId,
    },
  });
}
