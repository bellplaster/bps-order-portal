import {
  expiredSessionCookie,
} from "../_shared/auth.js";

import {
  json,
} from "../_shared/responses.js";

export function onRequestPost() {
  return json(
    {
      ok: true,
    },
    200,
    {
      "Set-Cookie": expiredSessionCookie(),
    },
  );
}
