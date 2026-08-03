import {
  isAdministratorRole,
  isCustomerServiceRole,
  normaliseUserRole,
} from "./user-roles.js";

export const ADMIN_TEST_DEBTOR_CODE = "STAFF";

export function normaliseRole(value) {
  return normaliseUserRole(value);
}

export function getOrderScope(viewer) {
  if (isAdministratorRole(viewer?.role)) return "all";
  if (isCustomerServiceRole(viewer?.role)) return "staff";
  if (Number(viewer?.is_primary) === 1) return "account";
  return "own";
}

export function isInternalTestOrder(order) {
  const debtorCode = String(order?.debtor_code_snapshot || order?.debtor_code || "").trim().toUpperCase();
  const creatorRole = normaliseRole(order?.creator_role || order?.created_by_role);
  return debtorCode === ADMIN_TEST_DEBTOR_CODE || creatorRole === "admin";
}

export function canViewOrder(viewer, order) {
  const scope = getOrderScope(viewer);
  if (scope === "all") return true;
  if (scope === "staff") return !isInternalTestOrder(order);
  if (Number(viewer?.account_id || 0) !== Number(order?.account_id || 0)) return false;
  if (scope === "account") return true;
  return Number(viewer?.id || 0) === Number(order?.created_by_user_id || 0);
}

export function orderActionPermissions(viewer, status) {
  const administrator = isAdministratorRole(viewer?.role);
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
  if (!isAdministratorRole(viewer?.role)) {
    const error = new Error("Only an administrator can manage an order.");
    error.status = 403;
    throw error;
  }
}
