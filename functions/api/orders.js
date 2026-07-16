export async function onRequestGet(context) {
  const requestId = crypto.randomUUID();

  try {
    if (!context.env.DB) {
      throw new Error("Missing Cloudflare binding: DB");
    }

    const ordersResult = await context.env.DB.prepare(
      `SELECT
         submission_id,
         customer_reference,
         status,
         created_at,
         updated_at
       FROM orders
       ORDER BY created_at DESC
       LIMIT 100`,
    ).all();

    const orders = [];

    for (const order of ordersResult.results || []) {
      const filesResult = await context.env.DB.prepare(
        `SELECT
           id,
           floor,
           floor_label,
           filename,
           r2_key,
           item_count,
           created_at
         FROM order_files
         WHERE submission_id = ?
         ORDER BY id DESC`,
      )
        .bind(order.submission_id)
        .all();

      const files = (filesResult.results || []).map((file) => ({
        ...file,
        revision: inferRevision(file.filename),
        download_url: `/api/files/${file.id}`,
      }));

      orders.push({
        ...order,
        can_edit: order.status !== "cancelled",
        latest_revision: files.reduce(
          (highest, file) => Math.max(highest, file.revision),
          1,
        ),
        files,
      });
    }

    return Response.json(
      {
        ok: true,
        orders,
        requestId,
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "X-Request-ID": requestId,
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error?.message || String(error),
        requestId,
      },
      {
        status: 500,
        headers: {
          "X-Request-ID": requestId,
        },
      },
    );
  }
}

function inferRevision(filename) {
  const match = String(filename || "").match(
    /-R(\d+)-(?:GF|L1)\.xlsx$/i,
  );

  return match
    ? Number(match[1])
    : 1;
}
