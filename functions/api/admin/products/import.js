export async function onRequestGet(context) {
  const requestId = crypto.randomUUID();

  try {
    await ensureSchema(context.env);

    const count = await context.env.DB.prepare(
      `SELECT COUNT(*) AS count
       FROM products
       WHERE active = 1`,
    ).first();

    const latest = await context.env.DB.prepare(
      `SELECT import_id, source_name, row_count, status, started_at, completed_at
       FROM product_imports
       ORDER BY started_at DESC
       LIMIT 1`,
    ).first();

    return respond({
      ok: true,
      activeProductCount: Number(count?.count || 0),
      latestImport: latest || null,
      requestId,
    }, requestId);
  } catch (error) {
    return respond({
      ok: false,
      error: error?.message || String(error),
      requestId,
    }, requestId, 500);
  }
}

export async function onRequestPost(context) {
  const requestId = crypto.randomUUID();

  try {
    if (!context.env.DB) {
      throw new Error("Missing Cloudflare binding: DB");
    }

    await ensureSchema(context.env);

    const payload = await context.request.json().catch(() => null);
    const action = String(payload?.action || "").trim().toLowerCase();

    if (action === "begin") {
      const importId = crypto.randomUUID();
      const sourceName = cleanText(payload?.sourceName, 200) || "Accrivia CSV";
      const startedAt = new Date().toISOString();

      await context.env.DB.prepare(
        `INSERT INTO product_imports (
           import_id, source_name, row_count, status, started_at, completed_at
         ) VALUES (?, ?, 0, 'processing', ?, NULL)`,
      )
        .bind(importId, sourceName, startedAt)
        .run();

      return respond({
        ok: true,
        importId,
        requestId,
      }, requestId);
    }

    const importId = cleanText(payload?.importId, 120);

    if (!importId) {
      throw new Error("Import ID is required.");
    }

    const importRecord = await context.env.DB.prepare(
      `SELECT import_id, status
       FROM product_imports
       WHERE import_id = ?`,
    )
      .bind(importId)
      .first();

    if (!importRecord) {
      throw new Error("The product import session was not found.");
    }

    if (action === "batch") {
      const products = Array.isArray(payload?.products)
        ? payload.products
        : [];

      if (products.length === 0 || products.length > 100) {
        throw new Error("Each import batch must contain 1 to 100 products.");
      }

      const now = new Date().toISOString();
      const statements = products.map((product) => {
        const sku = cleanText(product?.sku, 80).toUpperCase();
        const description = cleanText(product?.description, 500);

        if (!sku || !description) {
          throw new Error("Every product requires a stock code and description.");
        }

        const stockGroup = cleanText(product?.stockGroup, 160);
        const warehouse = cleanText(product?.warehouse, 120);
        const available = nullableNumber(product?.available);
        const descriptionSearch = normaliseSearch(description);
        const searchCompact = compactSearch(`${sku} ${description}`);

        return context.env.DB.prepare(
          `INSERT INTO products (
             sku,
             description_raw,
             description_search,
             search_compact,
             stock_group,
             warehouse,
             available,
             active,
             import_id,
             updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
           ON CONFLICT(sku) DO UPDATE SET
             description_raw = excluded.description_raw,
             description_search = excluded.description_search,
             search_compact = excluded.search_compact,
             stock_group = excluded.stock_group,
             warehouse = excluded.warehouse,
             available = excluded.available,
             active = 1,
             import_id = excluded.import_id,
             updated_at = excluded.updated_at`,
        ).bind(
          sku,
          description,
          descriptionSearch,
          searchCompact,
          stockGroup,
          warehouse,
          available,
          importId,
          now,
        );
      });

      await context.env.DB.batch(statements);

      await context.env.DB.prepare(
        `UPDATE product_imports
         SET row_count = row_count + ?
         WHERE import_id = ?`,
      )
        .bind(products.length, importId)
        .run();

      return respond({
        ok: true,
        imported: products.length,
        requestId,
      }, requestId);
    }

    if (action === "finish") {
      const now = new Date().toISOString();

      await context.env.DB.batch([
        context.env.DB.prepare(
          `UPDATE products
           SET active = 0,
               updated_at = ?
           WHERE COALESCE(import_id, '') <> ?`,
        ).bind(now, importId),
        context.env.DB.prepare(
          `UPDATE product_imports
           SET status = 'completed',
               completed_at = ?
           WHERE import_id = ?`,
        ).bind(now, importId),
      ]);

      const count = await context.env.DB.prepare(
        `SELECT COUNT(*) AS count
         FROM products
         WHERE active = 1`,
      ).first();

      return respond({
        ok: true,
        activeProductCount: Number(count?.count || 0),
        requestId,
      }, requestId);
    }

    throw new Error('Action must be "begin", "batch", or "finish".');
  } catch (error) {
    return respond({
      ok: false,
      error: error?.message || String(error),
      requestId,
    }, requestId, 400);
  }
}

async function ensureSchema(env) {
  if (!env.DB) {
    throw new Error("Missing Cloudflare binding: DB");
  }

  await env.DB.batch([
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS products (
         sku TEXT PRIMARY KEY COLLATE NOCASE,
         description_raw TEXT NOT NULL,
         description_search TEXT NOT NULL,
         search_compact TEXT NOT NULL,
         stock_group TEXT,
         warehouse TEXT,
         available REAL,
         active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
         import_id TEXT,
         updated_at TEXT NOT NULL
       )`,
    ),
    env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_products_active_sku
       ON products(active, sku)`,
    ),
    env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_products_import_id
       ON products(import_id)`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS product_imports (
         import_id TEXT PRIMARY KEY,
         source_name TEXT,
         row_count INTEGER NOT NULL DEFAULT 0,
         status TEXT NOT NULL,
         started_at TEXT NOT NULL,
         completed_at TEXT
       )`,
    ),
  ]);
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

function cleanText(value, maxLength) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  if (text.length > maxLength) {
    throw new Error(`A product field exceeds ${maxLength} characters.`);
  }
  return text;
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

function respond(body, requestId, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Request-ID": requestId,
    },
  });
}
