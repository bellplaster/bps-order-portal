import { json } from "../../_shared/responses.js";

export async function onRequest(context) {
  const auth = context.data?.auth;

  if (!auth?.userId) {
    return json({ ok: false, error: "Authentication required." }, 401);
  }

  if (auth.role !== "admin") {
    return json({ ok: false, error: "Administrator access required." }, 403);
  }

  return context.next();
}
