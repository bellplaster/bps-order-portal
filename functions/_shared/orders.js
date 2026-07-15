import {
  PRODUCT_CATALOG,
} from "./catalog.js";

import {
  createAccriviaXlsx,
} from "./xlsx.js";

const CONFIG = Object.freeze({
  debtorCode: "BPS BRUNSW17",
  companyName: "BPS Brunswick Plastering Services",
  addressLine1: "125 Sussex Street",
  addressLine2: "Pascoe Vale VIC 3044",
  addressLine3: "",
  salesRepCode: "",
  timeZone: "Australia/Melbourne",
  maxItemsPerFloor: 250,
});

const FLOORS = Object.freeze({
  ground: {
    label: "Ground Floor",
    shortCode: "GF",
  },

  first: {
    label: "1st Floor",
    shortCode: "L1",
  },
});

export function getCatalogResponse() {
  return {
    ok: true,
    service: "BPS Order Portal",
    productCount: Object.keys(PRODUCT_CATALOG).length,
    products: PRODUCT_CATALOG,
  };
}

export async function processOrderSubmission(env, rawPayload) {
  requireBindings(env);

  const submissionId = cleanRequiredText(
    rawPayload?.submissionId,
    "Submission ID",
    120,
  );

  const inserted = await reserveSubmission(
    env,
    submissionId,
    rawPayload,
  );

  if (!inserted) {
    return buildDuplicateResponse(env, submissionId);
  }

  let stage = "Submission reserved";

  try {
    stage = "Validating products";
    await addEvent(env, submissionId, stage);

    const floors = normaliseFloors(rawPayload?.floors);

    if (Object.keys(floors).length === 0) {
      throw new Error("The order contains no included floor.");
    }

    const orderRecord = await env.DB.prepare(
      `SELECT rowid, customer_reference
       FROM orders
       WHERE submission_id = ?`,
    )
      .bind(submissionId)
      .first();

    const orderNumber =
      orderRecord?.customer_reference ||
      `BPS${orderRecord?.rowid || Date.now()}`;

    const dateOrdered = todayInMelbourne();
    const generatedFiles = [];
    const manualReview = [];

    for (const [floorKey, floor] of Object.entries(floors)) {
      const definition = FLOORS[floorKey];

      if (floor.otherProducts) {
        manualReview.push({
          floor: floorKey,
          floorLabel: definition.label,
          details: floor.otherProducts,
        });
      }

      if (floor.items.length === 0) {
        continue;
      }

      stage = `Generating ${definition.label} XLSX`;
      await addEvent(env, submissionId, stage);

      const productRows = floor.items.map((item) => {
        const product = PRODUCT_CATALOG[item.key];

        return [
          product.sku,
          product.description,
          item.quantity,
          "",
        ];
      });

      const filename =
        `BPS-${orderNumber}-${definition.shortCode}.xlsx`;

      const workbook = createAccriviaXlsx({
        debtorCode: CONFIG.debtorCode,
        orderDate: dateOrdered,
        requiredDate: dateOrdered,
        orderNumber,
        jobName:
          `${CONFIG.companyName} - ${definition.label}`,
        addressLine1: CONFIG.addressLine1,
        addressLine2: CONFIG.addressLine2,
        addressLine3: CONFIG.addressLine3,
        salesRepCode: CONFIG.salesRepCode,
        productRows,
      });

      const r2Key = [
        "orders",
        dateOrdered.slice(0, 4),
        dateOrdered.slice(5, 7),
        submissionId,
        filename,
      ].join("/");

      stage = `Saving ${definition.label} XLSX to R2`;
      await addEvent(env, submissionId, stage);

      await env.ORDER_FILES.put(
        r2Key,
        workbook.bytes,
        {
          httpMetadata: {
            contentType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          },
          customMetadata: {
            submissionId,
            orderNumber,
            floor: floorKey,
          },
        },
      );

      await env.DB.prepare(
        `INSERT INTO order_files (
          submission_id,
          floor,
          floor_label,
          filename,
          r2_key,
          item_count,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          submissionId,
          floorKey,
          definition.label,
          filename,
          r2Key,
          productRows.length,
          nowIso(),
        )
        .run();

      generatedFiles.push({
        floor: floorKey,
        floorLabel: definition.label,
        filename,
        itemCount: productRows.length,
        r2Key,
      });
    }

    if (
      generatedFiles.length === 0 &&
      manualReview.length === 0
    ) {
      throw new Error("No products were supplied.");
    }

    stage = "Saving order metadata";
    await addEvent(env, submissionId, stage);

    await env.ORDER_FILES.put(
      [
        "orders",
        dateOrdered.slice(0, 4),
        dateOrdered.slice(5, 7),
        submissionId,
        "submission.json",
      ].join("/"),
      JSON.stringify(
        {
          submissionId,
          orderNumber,
          debtorCode: CONFIG.debtorCode,
          companyName: CONFIG.companyName,
          addressLine1: CONFIG.addressLine1,
          addressLine2: CONFIG.addressLine2,
          addressLine3: CONFIG.addressLine3,
          floors,
          generatedFiles,
          manualReview,
        },
        null,
        2,
      ),
      {
        httpMetadata: {
          contentType: "application/json",
        },
      },
    );

    await env.DB.prepare(
      `UPDATE orders
       SET status = 'completed',
           payload_json = ?,
           updated_at = ?
       WHERE submission_id = ?`,
    )
      .bind(
        JSON.stringify(rawPayload),
        nowIso(),
        submissionId,
      )
      .run();

    await addEvent(env, submissionId, "Completed");

    return {
      ok: true,
      duplicate: false,
      submissionId,
      customerReference: orderNumber,
      generatedFiles,
      manualReview,
      emailSent: false,
      completedAt: nowIso(),
    };
  } catch (error) {
    const message =
      error?.message || String(error);

    const stack =
      error?.stack || "";

    await env.DB.prepare(
      `UPDATE orders
       SET status = 'failed',
           updated_at = ?
       WHERE submission_id = ?`,
    )
      .bind(
        nowIso(),
        submissionId,
      )
      .run()
      .catch(() => null);

    await addEvent(
      env,
      submissionId,
      stage,
      JSON.stringify({
        error: message,
        stack,
      }),
    ).catch(() => null);

    error.diagnostic = {
      lastStage: {
        stage,
      },
      lastError: {
        message,
        stack,
      },
    };

    throw error;
  }
}

export async function getStatusResponse(env) {
  requireBindings(env);

  const latestOrder = await env.DB.prepare(
    `SELECT *
     FROM orders
     ORDER BY created_at DESC
     LIMIT 1`,
  ).first();

  if (!latestOrder) {
    return {
      ok: true,
      service: "BPS Order Portal",
      latestOrder: null,
      latestFiles: [],
      latestEvents: [],
      lastStage: null,
      lastError: null,
    };
  }

  const filesResult = await env.DB.prepare(
    `SELECT floor, floor_label, filename, r2_key, item_count, created_at
     FROM order_files
     WHERE submission_id = ?
     ORDER BY id`,
  )
    .bind(latestOrder.submission_id)
    .all();

  const eventsResult = await env.DB.prepare(
    `SELECT stage, detail, created_at
     FROM order_events
     WHERE submission_id = ?
     ORDER BY id DESC
     LIMIT 25`,
  )
    .bind(latestOrder.submission_id)
    .all();

  const events = eventsResult.results || [];
  const latestEvent = events[0] || null;

  let lastError = null;

  if (
    latestOrder.status === "failed" &&
    latestEvent?.detail
  ) {
    try {
      const detail = JSON.parse(latestEvent.detail);

      lastError = {
        message: detail.error || latestEvent.detail,
        stack: detail.stack || "",
      };
    } catch (_error) {
      lastError = {
        message: latestEvent.detail,
        stack: "",
      };
    }
  }

  return {
    ok: true,
    service: "BPS Order Portal",
    latestOrder,
    latestFiles: filesResult.results || [],
    latestEvents: events,
    lastStage: latestEvent
      ? { stage: latestEvent.stage }
      : null,
    lastError,
  };
}

async function reserveSubmission(
  env,
  submissionId,
  rawPayload,
) {
  const now = nowIso();

  const result = await env.DB.prepare(
    `INSERT OR IGNORE INTO orders (
      submission_id,
      customer_reference,
      project_name,
      site_address,
      suburb_state_postcode,
      site_contact,
      site_contact_phone,
      order_contact,
      order_contact_phone,
      general_comments,
      status,
      payload_json,
      created_at,
      updated_at
    ) VALUES (?, '', ?, ?, ?, '', '', 'BPS', '', '', 'processing', ?, ?, ?)`,
  )
    .bind(
      submissionId,
      CONFIG.companyName,
      CONFIG.addressLine1,
      CONFIG.addressLine2,
      JSON.stringify(rawPayload),
      now,
      now,
    )
    .run();

  const inserted =
    Number(result?.meta?.changes || 0) > 0;

  if (!inserted) {
    return false;
  }

  const row = await env.DB.prepare(
    `SELECT rowid
     FROM orders
     WHERE submission_id = ?`,
  )
    .bind(submissionId)
    .first();

  await env.DB.prepare(
    `UPDATE orders
     SET customer_reference = ?,
         updated_at = ?
     WHERE submission_id = ?`,
  )
    .bind(
      `BPS${row?.rowid || Date.now()}`,
      nowIso(),
      submissionId,
    )
    .run();

  return true;
}

async function buildDuplicateResponse(
  env,
  submissionId,
) {
  const order = await env.DB.prepare(
    `SELECT *
     FROM orders
     WHERE submission_id = ?`,
  )
    .bind(submissionId)
    .first();

  const filesResult = await env.DB.prepare(
    `SELECT floor, floor_label, filename, r2_key, item_count
     FROM order_files
     WHERE submission_id = ?
     ORDER BY id`,
  )
    .bind(submissionId)
    .all();

  return {
    ok: true,
    duplicate: true,
    submissionId,
    customerReference:
      order?.customer_reference || "",
    generatedFiles:
      filesResult.results || [],
    manualReview: [],
    emailSent: false,
    completedAt:
      order?.updated_at || null,
    previousStatus:
      order?.status || null,
  };
}

function normaliseFloors(
  rawFloors,
) {
  const floors = {};

  for (const floorKey of Object.keys(FLOORS)) {
    const rawFloor =
      rawFloors?.[floorKey];

    if (!rawFloor) {
      continue;
    }

    const items =
      normaliseItems(
        floorKey,
        rawFloor.items,
      );

    const otherProducts =
      cleanOptionalText(
        rawFloor.otherProducts,
        3000,
      );

    if (
      items.length === 0 &&
      !otherProducts
    ) {
      continue;
    }

    floors[floorKey] = {
      items,
      otherProducts,
    };
  }

  return floors;
}

function normaliseItems(
  floorKey,
  rawItems,
) {
  const items =
    Array.isArray(rawItems)
      ? rawItems
      : [];

  if (
    items.length >
    CONFIG.maxItemsPerFloor
  ) {
    throw new Error(
      `${FLOORS[floorKey].label}: Too many product lines.`,
    );
  }

  const totals = {};

  items.forEach((item, index) => {
    const key =
      String(item?.key || "").trim();

    if (!key) {
      throw new Error(
        `${FLOORS[floorKey].label}: Product line ${index + 1} has no product key.`,
      );
    }

    const product =
      PRODUCT_CATALOG[key];

    if (!product) {
      throw new Error(
        `${FLOORS[floorKey].label}: Unknown product key "${key}".`,
      );
    }

    if (
      !product.floors.includes(
        floorKey,
      )
    ) {
      throw new Error(
        `${product.label} is not available for ${FLOORS[floorKey].label}.`,
      );
    }

    const quantity =
      Number(item.quantity);

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      throw new Error(
        `${FLOORS[floorKey].label}: ${product.label} requires a positive whole-number quantity.`,
      );
    }

    totals[key] =
      (totals[key] || 0) +
      quantity;
  });

  return Object.entries(totals).map(
    ([key, quantity]) => ({
      key,
      quantity,
    }),
  );
}

async function addEvent(
  env,
  submissionId,
  stage,
  detail = null,
) {
  await env.DB.prepare(
    `INSERT INTO order_events (
      submission_id,
      stage,
      detail,
      created_at
    ) VALUES (?, ?, ?, ?)`,
  )
    .bind(
      submissionId,
      stage,
      detail,
      nowIso(),
    )
    .run();
}

function requireBindings(
  env,
) {
  const missing = [];

  if (!env.DB) {
    missing.push("DB");
  }

  if (!env.ORDER_FILES) {
    missing.push("ORDER_FILES");
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing Cloudflare binding: ${missing.join(", ")}`,
    );
  }
}

function cleanRequiredText(
  value,
  label,
  maxLength,
) {
  const text =
    cleanOptionalText(
      value,
      maxLength,
    );

  if (!text) {
    throw new Error(
      `${label} is required.`,
    );
  }

  return text;
}

function cleanOptionalText(
  value,
  maxLength,
) {
  const text =
    String(value ?? "")
      .trim()
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");

  if (
    maxLength &&
    text.length > maxLength
  ) {
    throw new Error(
      `A text field exceeds the ${maxLength} character limit.`,
    );
  }

  return text;
}

function todayInMelbourne() {
  const formatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: CONFIG.timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
    );

  const parts =
    Object.fromEntries(
      formatter
        .formatToParts(new Date())
        .filter(
          (part) =>
            part.type !== "literal",
        )
        .map(
          (part) => [
            part.type,
            part.value,
          ],
        ),
    );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function nowIso() {
  return new Date().toISOString();
}
