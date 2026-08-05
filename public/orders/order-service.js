export async function fetchOrders() {
  return fetchJson("/api/orders");
}

export async function fetchOrder(submissionId) {
  return fetchJson(`/api/orders/${encodeURIComponent(submissionId)}`);
}

export async function setOrderStatus(submissionId, action) {
  return fetchJson(`/api/orders/${encodeURIComponent(submissionId)}`, {
    method: "PATCH",
    body: JSON.stringify({ action }),
  });
}

export async function permanentlyDeleteOrder(submissionId) {
  return fetchJson(`/api/orders/${encodeURIComponent(submissionId)}`, {
    method: "DELETE",
  });
}

export async function signOut() {
  await fetchJson("/api/logout", { method: "POST" });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) {
    const error = new Error(body?.error || `Request failed with status ${response.status}.`);
    error.status = response.status;
    error.requestId = body?.requestId || response.headers.get("X-Request-ID") || "";
    throw error;
  }
  return body;
}
