export async function onRequestGet(context) {
  const fileId = Number(context.params.id);

  if (!Number.isInteger(fileId) || fileId <= 0) {
    return Response.json(
      {
        ok: false,
        error: "Invalid file ID.",
      },
      {
        status: 400,
      },
    );
  }

  if (!context.env.DB || !context.env.ORDER_FILES) {
    return Response.json(
      {
        ok: false,
        error: "Required Cloudflare bindings are missing.",
      },
      {
        status: 500,
      },
    );
  }

  const file = await context.env.DB.prepare(
    `SELECT filename, r2_key
     FROM order_files
     WHERE id = ?`,
  )
    .bind(fileId)
    .first();

  if (!file) {
    return Response.json(
      {
        ok: false,
        error: "File record not found.",
      },
      {
        status: 404,
      },
    );
  }

  const object = await context.env.ORDER_FILES.get(file.r2_key);

  if (!object) {
    return Response.json(
      {
        ok: false,
        error: "The XLSX file is missing from R2.",
      },
      {
        status: 404,
      },
    );
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  headers.set(
    "Content-Disposition",
    `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
  );
  headers.set("Cache-Control", "private, no-store");
  headers.set("ETag", object.httpEtag);

  return new Response(object.body, {
    headers,
  });
}
