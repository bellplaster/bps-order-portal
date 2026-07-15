import {
  processOrderSubmission,
} from "../_shared/orders.js";

export async function onRequestPost(
  context,
) {
  const requestId =
    crypto.randomUUID();

  try {
    const contentLength = Number(
      context.request.headers.get(
        "Content-Length",
      ) || 0,
    );

    if (contentLength > 200_000) {
      return Response.json(
        {
          ok: false,
          error:
            "The submission exceeds the 200 KB request limit.",
          requestId,
        },
        {
          status: 413,
          headers: {
            "X-Request-ID":
              requestId,
          },
        },
      );
    }

    const payload =
      await context.request.json()
        .catch(() => null);

    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload)
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "The portal submitted invalid JSON.",
          requestId,
        },
        {
          status: 400,
          headers: {
            "X-Request-ID":
              requestId,
          },
        },
      );
    }

    const result =
      await processOrderSubmission(
        context.env,
        payload,
      );

    return Response.json(
      {
        ...result,
        requestId,
      },
      {
        headers: {
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
        diagnostic:
          error?.diagnostic ||
          null,
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
