export async function onRequestGet(context) {
  return readOnlyResponse(context);
}

export async function onRequestPut(context) {
  return readOnlyResponse(context);
}

export async function onRequestPatch(context) {
  return readOnlyResponse(context);
}

export async function onRequestDelete(context) {
  return readOnlyResponse(context);
}

function readOnlyResponse(context) {
  const requestId = crypto.randomUUID();
  const auth = context.data?.auth;
  if (!auth?.userId) {
    return Response.json({ ok: false, error: "Authentication required.", requestId }, {
      status: 401,
      headers: { "Cache-Control": "no-store", "X-Request-ID": requestId },
    });
  }
  return Response.json({
    ok: false,
    error: "Submitted orders are permanent records and cannot be edited, resubmitted, archived, restored or deleted.",
    requestId,
  }, {
    status: 405,
    headers: {
      Allow: "",
      "Cache-Control": "no-store",
      "X-Request-ID": requestId,
    },
  });
}
