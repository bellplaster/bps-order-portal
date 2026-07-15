import {
  PRODUCT_CATALOG,
} from "./catalog.js";

import {
  createAccriviaXlsx,
} from "./xlsx.js";

const CONFIG = Object.freeze({
  debtorCode: "BPS BRUNSW17",
  salesRepCode: "",
  timeZone: "Australia/Melbourne",
  maxItemsPerFloor: 250,
  xlsxMime:
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
});

const FLOORS = Object.freeze({
  ground: {
    key: "ground",
    label: "Ground Floor",
    shortCode: "GF",
  },

  first: {
    key: "first",
    label: "1st Floor",
    shortCode: "L1",
  },
});

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
    return await buildDuplicateResponse(
      env,
      submissionId,
    );
  }

  let currentStage = "Submission reserved";

  try {
    currentStage = "Validating submission fields";
    await setStage(env, submissionId, currentStage);

    const submission = normaliseSubmission(rawPayload);

    await env.DB.prepare(
      `UPDATE orders
       SET customer_reference = ?,
           job_name = ?,
           site_address_1 = ?,
           site_address_2 = ?,
           requester_name = ?,
           raw_payload = ?
       WHERE submission_id = ?`,
    )
      .bind(
        submission.customerReference,
        submission.jobName,
        submission.siteAddress1,
        submission.siteAddress2,
        submission.requesterName,
        JSON.stringify(rawPayload),
        submissionId,
      )
      .run();

    currentStage = "Preparing floor orders";
    await setStage(env, submissionId, currentStage);

    const floorOrders = Object.keys(FLOORS)
      .map((floorKey) => {
        const floor = submission.floors[floorKey];

        if (!floor) {
          return null;
        }

        return buildFloorOrder(
          submission,
          floorKey,
          floor,
        );
      })
      .filter(Boolean);

    if (floorOrders.length === 0) {
      throw new Error(
        "The submission contains no Ground Floor or 1st Floor order.",
      );
    }

    const generatedFiles = [];
    const attachments = [];

    for (const order of floorOrders) {
      if (order.productRows.length === 0) {
        continue;
      }

      currentStage = `Generating ${order.floorLabel} XLSX`;
      await setStage(env, submissionId, currentStage);

      const workbook = createAccriviaXlsx({
        debtorCode: CONFIG.debtorCode,
        orderDate: submission.dateOrdered,
        requiredDate: order.requiredDate,
        orderNumber: order.orderNumber,
        jobName: order.jobName,
        addressLine1: submission.siteAddress1,
        addressLine2: submission.siteAddress2,
        addressLine3: submission.addressLine3,
        salesRepCode: CONFIG.salesRepCode,
        productRows: order.productRows,
      });

      const r2Key = buildR2Key(
        submission,
        order.filename,
      );

      currentStage = `Saving ${order.floorLabel} XLSX to R2`;
      await setStage(env, submissionId, currentStage);

      await env.ORDER_FILES.put(
        r2Key,
        workbook.bytes,
        {
          httpMetadata: {
            contentType: CONFIG.xlsxMime,
          },

          customMetadata: {
            submissionId,
            customerReference:
              submission.customerReference,
            floor: order.floorKey,
            floorLabel: order.floorLabel,
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
          order.floorKey,
          order.floorLabel,
          order.filename,
          r2Key,
          order.productRows.length,
          nowIso(),
        )
        .run();

      generatedFiles.push({
        floor: order.floorKey,
        floorLabel: order.floorLabel,
        filename: order.filename,
        itemCount: order.productRows.length,
        r2Key,
      });

      attachments.push({
        bytes: workbook.bytes,
        filename: order.filename,
        mimeType: CONFIG.xlsxMime,
      });
    }

    const manualReview = floorOrders
      .filter((order) => Boolean(order.otherProducts))
      .map((order) => ({
        floor: order.floorKey,
        floorLabel: order.floorLabel,
        details: order.otherProducts,
      }));

    if (
      generatedFiles.length === 0 &&
      manualReview.length === 0
    ) {
      throw new Error(
        "No verified products or manual-review products were supplied.",
      );
    }

    currentStage = "Saving submission metadata to R2";
    await setStage(env, submissionId, currentStage);

    const metadataKey = buildMetadataKey(submission);

    await env.ORDER_FILES.put(
      metadataKey,
      JSON.stringify(
        {
          submission,
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

    currentStage = "Sending Bell Plaster email";
    await setStage(env, submissionId, currentStage);

    const emailResult = await sendOrderEmail(
      env,
      submission,
      floorOrders,
      generatedFiles,
      manualReview,
      attachments,
    );

    const completedAt = nowIso();

    await env.DB.prepare(
      `UPDATE orders
       SET status = 'completed',
           current_stage = 'Completed',
           error_message = NULL,
           error_stack = NULL,
           email_status = ?,
           email_response = ?,
           completed_at = ?
       WHERE submission_id = ?`,
    )
      .bind(
        "sent",
        JSON.stringify(emailResult),
        completedAt,
        submissionId,
      )
      .run();

    await addEvent(
      env,
      submissionId,
      "Completed",
      JSON.stringify({
        generatedFileCount: generatedFiles.length,
        manualReviewCount: manualReview.length,
      }),
    );

    return {
      ok: true,
      duplicate: false,
      submissionId,
      customerReference:
        submission.customerReference,
      generatedFiles,
      manualReview,
      emailSent: true,
      emailResult,
      completedAt,
    };
  } catch (error) {
    const errorMessage =
      error?.message || String(error);

    const errorStack =
      error?.stack || "";

    await recordFailure(
      env,
      submissionId,
      currentStage,
      errorMessage,
      errorStack,
    ).catch(() => null);

    error.diagnostic = {
      lastStage: {
        stage: currentStage,
      },

      lastError: {
        message: errorMessage,
        stack: errorStack,
      },
    };

    throw error;
  }
}

export function getCatalogResponse() {
  return {
    ok: true,
    service: "BPS Order Portal",
    productCount:
      Object.keys(PRODUCT_CATALOG).length,
    products: PRODUCT_CATALOG,
  };
}

export async function getStatusResponse(env) {
  requireBindings(env, {
    email: false,
  });

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

  const latestFiles = await env.DB.prepare(
    `SELECT floor, floor_label, filename, r2_key, item_count, created_at
     FROM order_files
     WHERE submission_id = ?
     ORDER BY id`,
  )
    .bind(latestOrder.submission_id)
    .all();

  const latestEvents = await env.DB.prepare(
    `SELECT stage, detail, created_at
     FROM order_events
     WHERE submission_id = ?
     ORDER BY id DESC
     LIMIT 25`,
  )
    .bind(latestOrder.submission_id)
    .all();

  return {
    ok: true,
    service: "BPS Order Portal",
    latestOrder,
    latestFiles:
      latestFiles.results || [],
    latestEvents:
      latestEvents.results || [],

    lastStage: {
      stage:
        latestOrder.current_stage,
    },

    lastError:
      latestOrder.status === "failed"
        ? {
            message:
              latestOrder.error_message,
            stack:
              latestOrder.error_stack,
          }
        : null,
  };
}

function requireBindings(
  env,
  options = {},
) {
  const missing = [];

  if (!env.DB) {
    missing.push("DB");
  }

  if (!env.ORDER_FILES) {
    missing.push("ORDER_FILES");
  }

  if (options.email !== false) {
    [
      "CLOUDFLARE_ACCOUNT_ID",
      "CLOUDFLARE_EMAIL_API_TOKEN",
      "EMAIL_FROM",
      "EMAIL_TO",
    ].forEach((name) => {
      if (!String(env[name] || "").trim()) {
        missing.push(name);
      }
    });
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing Cloudflare binding or secret: ${missing.join(", ")}`,
    );
  }
}

async function reserveSubmission(
  env,
  submissionId,
  rawPayload,
) {
  const result = await env.DB.prepare(
    `INSERT OR IGNORE INTO orders (
      submission_id,
      customer_reference,
      job_name,
      site_address_1,
      site_address_2,
      requester_name,
      status,
      current_stage,
      raw_payload,
      created_at
    ) VALUES (?, '', '', '', '', '', 'processing', 'Submission reserved', ?, ?)`,
  )
    .bind(
      submissionId,
      JSON.stringify(rawPayload),
      nowIso(),
    )
    .run();

  return Number(result?.meta?.changes || 0) > 0;
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

  const files = await env.DB.prepare(
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
      (files.results || []).map((file) => ({
        floor: file.floor,
        floorLabel: file.floor_label,
        filename: file.filename,
        itemCount: file.item_count,
        r2Key: file.r2_key,
      })),
    manualReview: [],
    emailSent:
      order?.email_status === "sent",
    completedAt:
      order?.completed_at || null,
    previousStatus:
      order?.status || null,
  };
}

async function setStage(
  env,
  submissionId,
  stage,
) {
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE orders
       SET current_stage = ?
       WHERE submission_id = ?`,
    ).bind(stage, submissionId),

    env.DB.prepare(
      `INSERT INTO order_events (
        submission_id,
        stage,
        detail,
        created_at
      ) VALUES (?, ?, NULL, ?)`,
    ).bind(
      submissionId,
      stage,
      nowIso(),
    ),
  ]);
}

async function addEvent(
  env,
  submissionId,
  stage,
  detail,
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

async function recordFailure(
  env,
  submissionId,
  stage,
  message,
  stack,
) {
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE orders
       SET status = 'failed',
           current_stage = ?,
           error_message = ?,
           error_stack = ?,
           completed_at = ?
       WHERE submission_id = ?`,
    ).bind(
      stage,
      message,
      stack,
      nowIso(),
      submissionId,
    ),

    env.DB.prepare(
      `INSERT INTO order_events (
        submission_id,
        stage,
        detail,
        created_at
      ) VALUES (?, ?, ?, ?)`,
    ).bind(
      submissionId,
      stage,
      JSON.stringify({
        error: message,
        stack,
      }),
      nowIso(),
    ),
  ]);
}

function normaliseSubmission(
  payload,
) {
  const submissionId = cleanRequiredText(
    payload.submissionId,
    "Submission ID",
    120,
  );

  const customerReference = cleanRequiredText(
    payload.customerReference,
    "Customer Reference / PO",
    100,
  );

  const jobName = cleanRequiredText(
    payload.jobName,
    "Project / Job Name",
    160,
  );

  const siteAddress1 = cleanRequiredText(
    payload.siteAddress1,
    "Site Address",
    160,
  );

  const siteAddress2 = cleanRequiredText(
    payload.siteAddress2,
    "Suburb, State and Postcode",
    160,
  );

  const siteContact = cleanOptionalText(
    payload.siteContact,
    100,
  );

  const formattedPhone = formatAustralianPhone(
    payload.siteContactPhone,
  );

  const addressLine3 = formattedPhone
    ? [
        getFirstName(siteContact),
        formattedPhone,
      ]
        .filter(Boolean)
        .join(" ")
    : "";

  const requesterName = cleanRequiredText(
    payload.requesterName,
    "Order Contact",
    120,
  );

  const requesterPhone = formatAustralianPhone(
    payload.requesterPhone,
  );

  const comments = cleanOptionalText(
    payload.comments,
    2000,
  );

  const floors = {};

  Object.keys(FLOORS).forEach((floorKey) => {
    const rawFloor =
      payload?.floors?.[floorKey];

    if (rawFloor === null || rawFloor === undefined) {
      return;
    }

    const floor = normaliseFloor(
      floorKey,
      rawFloor,
    );

    if (floor) {
      floors[floorKey] = floor;
    }
  });

  return {
    submissionId,
    customerReference,
    jobName,
    siteAddress1,
    siteAddress2,
    addressLine3,
    siteContact,
    siteContactPhone:
      formattedPhone,
    requesterName,
    requesterPhone,
    comments,
    dateOrdered:
      todayInMelbourne(),
    floors,
  };
}

function normaliseFloor(
  floorKey,
  rawFloor,
) {
  const definition = FLOORS[floorKey];

  const items = normaliseItems(
    floorKey,
    rawFloor.items,
  );

  const otherProducts = cleanOptionalText(
    rawFloor.otherProducts,
    3000,
  );

  if (
    items.length === 0 &&
    !otherProducts
  ) {
    return null;
  }

  const requiredDate = validateIsoDate(
    rawFloor.dateRequired,
  );

  if (!requiredDate) {
    throw new Error(
      `${definition.label}: Date Required is missing or invalid.`,
    );
  }

  return {
    requiredDate,
    deliveryMode: cleanOptionalText(
      rawFloor.deliveryMode,
      40,
    ),
    deliverySequence: cleanOptionalText(
      rawFloor.deliverySequence,
      40,
    ),
    deliveryWindow: cleanOptionalText(
      rawFloor.deliveryWindow,
      40,
    ),
    clearAccess: Boolean(rawFloor.clearAccess),
    scaffolding: Boolean(rawFloor.scaffolding),
    passUp: Boolean(rawFloor.passUp),
    level: cleanOptionalText(
      rawFloor.level,
      80,
    ),
    areaSetAside: Boolean(rawFloor.areaSetAside),
    plasticWrap: Boolean(rawFloor.plasticWrap),
    deliveryNotes: cleanOptionalText(
      rawFloor.deliveryNotes,
      2000,
    ),
    items,
    otherProducts,
  };
}

function normaliseItems(
  floorKey,
  rawItems,
) {
  const items = Array.isArray(rawItems)
    ? rawItems
    : [];

  if (items.length > CONFIG.maxItemsPerFloor) {
    throw new Error(
      `${FLOORS[floorKey].label}: Too many product lines were supplied.`,
    );
  }

  const quantities = {};

  items.forEach((item, index) => {
    const key = String(
      item?.key || "",
    ).trim();

    if (!key) {
      throw new Error(
        `${FLOORS[floorKey].label}: Product line ${index + 1} has no product key.`,
      );
    }

    const product = PRODUCT_CATALOG[key];

    if (!product) {
      throw new Error(
        `${FLOORS[floorKey].label}: Unknown or unverified product key "${key}".`,
      );
    }

    if (!product.floors.includes(floorKey)) {
      throw new Error(
        `${product.label} is not available for ${FLOORS[floorKey].label}.`,
      );
    }

    const quantity = Number(
      item.quantity,
    );

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isInteger(quantity)
    ) {
      throw new Error(
        `${FLOORS[floorKey].label}: ${product.label} must have a positive whole-number quantity.`,
      );
    }

    quantities[key] =
      (quantities[key] || 0) +
      quantity;
  });

  return Object.entries(quantities).map(
    ([key, quantity]) => ({
      key,
      quantity,
    }),
  );
}

function buildFloorOrder(
  submission,
  floorKey,
  floor,
) {
  const definition = FLOORS[floorKey];

  return {
    floorKey,
    floorLabel:
      definition.label,
    orderNumber:
      submission.customerReference,
    jobName:
      `${submission.jobName} - ${definition.label}`,
    requiredDate:
      floor.requiredDate,
    filename:
      safeFilename(
        `BPS-${submission.customerReference}-${definition.shortCode}.xlsx`,
      ),
    productRows:
      floor.items.map((item) => {
        const product =
          PRODUCT_CATALOG[item.key];

        return [
          product.sku,
          product.description,
          item.quantity,
          "",
        ];
      }),
    otherProducts:
      floor.otherProducts,
    deliverySummary:
      buildDeliverySummary(floor),
  };
}

function buildDeliverySummary(
  floor,
) {
  const lines = [];

  [
    ["Mode", floor.deliveryMode],
    ["Sequence", floor.deliverySequence],
    ["Window", floor.deliveryWindow],
    ["Level", floor.level],
  ].forEach(([label, value]) => {
    if (value) {
      lines.push(`${label}: ${value}`);
    }
  });

  const flags = [];

  if (floor.clearAccess) {
    flags.push("Clear access");
  }

  if (floor.scaffolding) {
    flags.push("Scaffolding");
  }

  if (floor.passUp) {
    flags.push("Pass up");
  }

  if (floor.areaSetAside) {
    flags.push("Area set aside");
  }

  if (floor.plasticWrap) {
    flags.push("Plastic wrap");
  }

  if (flags.length > 0) {
    lines.push(
      `Requirements: ${flags.join(", ")}`,
    );
  }

  if (floor.deliveryNotes) {
    lines.push(
      `Notes: ${floor.deliveryNotes}`,
    );
  }

  return lines;
}

async function sendOrderEmail(
  env,
  submission,
  floorOrders,
  generatedFiles,
  manualReview,
  attachments,
) {
  const filesText = generatedFiles
    .map((file) => file.filename)
    .join(", ");

  const floorHtml = floorOrders
    .map((floor) => {
      const deliveryItems = floor.deliverySummary
        .map(
          (line) =>
            `<li>${escapeHtml(line)}</li>`,
        )
        .join("");

      const manualReviewHtml =
        floor.otherProducts
          ? `
            <div style="
              margin-top:10px;
              padding:10px 12px;
              background:#fff4e5;
              border-left:3px solid #c77600;
            ">
              <strong>Other products:</strong><br>
              ${escapeHtml(floor.otherProducts)}
            </div>
          `
          : "";

      return `
        <div style="
          margin:0 0 16px;
          padding:14px;
          border:1px solid #d9e2df;
          border-radius:6px;
        ">
          <h3 style="margin:0 0 8px;font-size:16px;">
            ${escapeHtml(floor.floorLabel)}
          </h3>

          <p style="margin:0 0 8px;">
            <strong>Date required:</strong>
            ${escapeHtml(floor.requiredDate)}
            <br>

            <strong>Verified product lines:</strong>
            ${floor.productRows.length}
          </p>

          ${
            deliveryItems
              ? `<ul style="margin:0;padding-left:20px;">${deliveryItems}</ul>`
              : ""
          }

          ${manualReviewHtml}
        </div>
      `;
    })
    .join("");

  const html = `
    <div style="
      font-family:Inter,Arial,Helvetica,sans-serif;
      color:#202124;
      font-size:14px;
      line-height:1.5;
      max-width:760px;
    ">
      <h2 style="margin:0 0 10px;font-size:21px;">
        BPS order ${escapeHtml(submission.customerReference)}
      </h2>

      <p style="margin:0 0 16px;">
        The Accrivia import files are attached and ready to upload.
      </p>

      <p style="margin:0 0 18px;">
        <strong>Project:</strong>
        ${escapeHtml(submission.jobName)}
        <br>

        <strong>Site:</strong>
        ${escapeHtml(submission.siteAddress1)},
        ${escapeHtml(submission.siteAddress2)}
        <br>

        <strong>Site contact:</strong>
        ${escapeHtml(submission.addressLine3 || "Not supplied")}
        <br>

        <strong>Requested by:</strong>
        ${escapeHtml(submission.requesterName)}
        ${
          submission.requesterPhone
            ? ` ${escapeHtml(submission.requesterPhone)}`
            : ""
        }
      </p>

      ${floorHtml}

      <div style="
        margin:0 0 16px;
        padding:12px 14px;
        background:#f3f7f6;
        border-left:3px solid #006557;
      ">
        <strong>Generated files:</strong><br>
        ${escapeHtml(filesText || "None")}
      </div>

      <p style="margin:0;">
        <strong>Comments:</strong><br>
        ${escapeHtml(submission.comments || "None")}
      </p>

      <p style="
        margin:18px 0 0;
        color:#6b7280;
        font-size:12px;
      ">
        Submission ID:
        ${escapeHtml(submission.submissionId)}
      </p>
    </div>
  `;

  const text = [
    `BPS order ${submission.customerReference}`,
    "",
    `Project: ${submission.jobName}`,
    `Site: ${submission.siteAddress1}, ${submission.siteAddress2}`,
    `Requested by: ${submission.requesterName}`,
    "",
    `Generated files: ${filesText || "None"}`,
    "",
    manualReview.length
      ? "This order includes Other Products for Bell Plaster to review."
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const payload = {
    to: parseEmailList(env.EMAIL_TO),
    from: String(env.EMAIL_FROM),
    subject:
      `BPS order ${submission.customerReference} - Accrivia files ready`,
    html,
    text,
    attachments:
      attachments.map((attachment) => ({
        content:
          bytesToBase64(attachment.bytes),
        filename:
          attachment.filename,
        type:
          attachment.mimeType,
        disposition:
          "attachment",
      })),
  };

  const cc = parseEmailList(
    env.EMAIL_CC,
  );

  if (
    Array.isArray(cc)
      ? cc.length > 0
      : Boolean(cc)
  ) {
    payload.cc = cc;
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
      env.CLOUDFLARE_ACCOUNT_ID,
    )}/email/sending/send`,
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${env.CLOUDFLARE_EMAIL_API_TOKEN}`,
        "Content-Type":
          "application/json",
      },
      body:
        JSON.stringify(payload),
    },
  );

  const result = await response.json()
    .catch(() => null);

  if (
    !response.ok ||
    result?.success !== true
  ) {
    const errors =
      Array.isArray(result?.errors)
        ? result.errors
            .map((error) =>
              `${error.code || ""} ${error.message || ""}`.trim(),
            )
            .join("; ")
        : "";

    throw new Error(
      errors ||
      `Cloudflare Email Service failed with HTTP ${response.status}.`,
    );
  }

  return result.result;
}

function buildR2Key(
  submission,
  filename,
) {
  const date = submission.dateOrdered;
  const [year, month] = date.split("/");

  /*
   * dateOrdered is yyyy-mm-dd; split with "-" below.
   */
  const parts = date.split("-");

  return [
    "orders",
    parts[0],
    parts[1],
    safePathSegment(submission.submissionId),
    filename,
  ].join("/");
}

function buildMetadataKey(
  submission,
) {
  const parts =
    submission.dateOrdered.split("-");

  return [
    "orders",
    parts[0],
    parts[1],
    safePathSegment(submission.submissionId),
    "submission.json",
  ].join("/");
}

function todayInMelbourne() {
  const formatter = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: CONFIG.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
  );

  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date())
      .filter((part) =>
        part.type !== "literal",
      )
      .map((part) => [
        part.type,
        part.value,
      ]),
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function validateIsoDate(
  value,
) {
  const text = String(value || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return "";
  }

  const [year, month, day] =
    text.split("-").map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day),
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "";
  }

  return text;
}

function cleanRequiredText(
  value,
  label,
  maxLength,
) {
  const text = cleanOptionalText(
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
  const text = String(value ?? "")
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

function formatAustralianPhone(
  value,
) {
  let digits = String(value || "")
    .replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (
    digits.startsWith("61") &&
    digits.length >= 11
  ) {
    digits =
      `0${digits.substring(2)}`;
  }

  if (/^04\d{8}$/.test(digits)) {
    return (
      `${digits.substring(0, 4)} ` +
      `${digits.substring(4, 7)} ` +
      digits.substring(7, 10)
    );
  }

  if (/^0[2378]\d{8}$/.test(digits)) {
    return (
      `${digits.substring(0, 2)} ` +
      `${digits.substring(2, 6)} ` +
      digits.substring(6, 10)
    );
  }

  return String(value || "").trim();
}

function getFirstName(
  fullName,
) {
  return String(fullName || "")
    .trim()
    .split(/\s+/)[0] || "";
}

function safeFilename(
  value,
) {
  return String(value || "order.xlsx")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

function safePathSegment(
  value,
) {
  return String(value || "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .slice(0, 160);
}

function parseEmailList(
  value,
) {
  const addresses = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (addresses.length <= 1) {
    return addresses[0] || "";
  }

  return addresses;
}

function bytesToBase64(
  bytes,
) {
  let binary = "";
  const chunkSize = 0x8000;

  for (
    let index = 0;
    index < bytes.length;
    index += chunkSize
  ) {
    binary += String.fromCharCode(
      ...bytes.subarray(
        index,
        Math.min(
          index + chunkSize,
          bytes.length,
        ),
      ),
    );
  }

  return btoa(binary);
}

function escapeHtml(
  value,
) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\n/g, "<br>");
}

function nowIso() {
  return new Date().toISOString();
}
