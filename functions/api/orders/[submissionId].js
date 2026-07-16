import {
  getOrderForEditing,
  updateOrderSubmission,
} from "../../_shared/orders.js";

export async function onRequestGet(context) {
  const requestId = crypto.randomUUID();

  try {
    const result = await getOrderForEditing(
      context.env,
      String(context.params.submissionId || ""),
    );

    return Response.json(
      {
        ...result,
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
        status: error?.message === "Order not found." ? 404 : 500,
        headers: {
          "X-Request-ID": requestId,
        },
      },
    );
  }
}

export async function onRequestPut(context) {
  const requestId = crypto.randomUUID();

  try {
    const payload = await context.request.json()
      .catch(() => null);

    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload)
    ) {
      return Response.json(
        {
          ok: false,
          error: "The portal submitted invalid JSON.",
          requestId,
        },
        {
          status: 400,
          headers: {
            "X-Request-ID": requestId,
          },
        },
      );
    }

    const result = await updateOrderSubmission(
      context.env,
      String(context.params.submissionId || ""),
      payload,
    );

    return Response.json(
      {
        ...result,
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
        diagnostic: error?.diagnostic || null,
        requestId,
      },
      {
        status: error?.message === "Order not found." ? 404 : 500,
        headers: {
          "X-Request-ID": requestId,
        },
      },
    );
  }
}
