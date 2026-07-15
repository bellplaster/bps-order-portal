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
           floor,
           floor_label,
           filename,
           r2_key,
           item_count
         FROM order_files
         WHERE submission_id = ?
         ORDER BY id`,
      )
        .bind(order.submission_id)
        .all();

      orders.push({
        ...order,
        files: filesResult.results || [],
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
