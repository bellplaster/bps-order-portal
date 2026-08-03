export const USER_ROLES = Object.freeze({
  ADMIN: "admin",
  CUSTOMER: "customer",
  CUSTOMER_SERVICE: "customer_service",
});

const SUPPORTED_ROLES = new Set(Object.values(USER_ROLES));
const INTERNAL_ROLES = new Set([USER_ROLES.ADMIN, USER_ROLES.CUSTOMER_SERVICE]);

export function normaliseUserRole(value) {
  return String(value || "").trim().toLowerCase();
}

export function isSupportedUserRole(value) {
  return SUPPORTED_ROLES.has(normaliseUserRole(value));
}

export function parseUserRole(value, fallback = null) {
  const role = normaliseUserRole(value);
  if (SUPPORTED_ROLES.has(role)) return role;
  return fallback && SUPPORTED_ROLES.has(normaliseUserRole(fallback))
    ? normaliseUserRole(fallback)
    : null;
}

export function effectiveUserRole(storedRole, accessRole = "") {
  return parseUserRole(accessRole) || parseUserRole(storedRole, USER_ROLES.CUSTOMER);
}

export function storedUserRole(value) {
  const role = parseUserRole(value, USER_ROLES.CUSTOMER);
  return role === USER_ROLES.CUSTOMER_SERVICE ? USER_ROLES.ADMIN : role;
}

export function isAdministratorRole(value) {
  return normaliseUserRole(value) === USER_ROLES.ADMIN;
}

export function isCustomerServiceRole(value) {
  return normaliseUserRole(value) === USER_ROLES.CUSTOMER_SERVICE;
}

export function isInternalRole(value) {
  return INTERNAL_ROLES.has(normaliseUserRole(value));
}

export function roleRequiresCustomerAccount(value) {
  return normaliseUserRole(value) === USER_ROLES.CUSTOMER;
}

export function userRoleLabel(value) {
  const role = normaliseUserRole(value);
  if (role === USER_ROLES.ADMIN) return "Administrator";
  if (role === USER_ROLES.CUSTOMER_SERVICE) return "Customer Service";
  return "Customer";
}
