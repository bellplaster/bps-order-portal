export function normaliseRole(value) {
  return String(value || "").trim().toLowerCase();
}

export function getOrderScope(viewer) {
  if (normaliseRole(viewer?.role) === "admin") return "all";
  if (Number(viewer?.is_primary) === 1) return "account";
  return "own";
}

export function canViewOrder(viewer, order) {
  const scope = getOrderScope(viewer);
  if (scope === "all") return true;
  if (Number(viewer?.account_id || 0) !== Number(order?.account_id || 0)) return false;
  if (scope === "account") return true;
  return Number(viewer?.id || 0) === Number(order?.created_by_user_id || 0);
}

export function orderActionPermissions(viewer, status) {
  const administrator = normaliseRole(viewer?.role) === "admin";
  const normalisedStatus = String(status || "").trim().toLowerCase();
  const archived = normalisedStatus === "archived";
  return {
    canEdit: false,
    canArchive: administrator && normalisedStatus === "completed",
    canRestore: administrator && archived,
    canDelete: administrator,
  };
}

export function assertAdministrator(viewer) {
  if (normaliseRole(viewer?.role) !== "admin") {
    const error = new Error("Only an administrator can manage an order.");
    error.status = 403;
    throw error;
  }
}
