import {
  getCatalogResponse,
} from "../_shared/orders.js";

export function onRequestGet() {
  return Response.json(
    getCatalogResponse(),
    {
      headers: {
        "Cache-Control":
          "private, max-age=300",
      },
    },
  );
}
