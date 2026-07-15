import {
  getStatusResponse,
} from "../_shared/orders.js";

export async function onRequestGet(
  context,
) {
  const requestId =
    crypto.randomUUID();

  try {
    const result =
      await getStatusResponse(
        context.env,
      );

    return Response.json(
      {
        ...result,
        requestId,
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
          "X-Request-ID":
            requestId,
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          String(error),
        requestId,
      },
      {
        status: 500,
        headers: {
          "X-Request-ID":
            requestId,
        },
      },
    );
  }
}
