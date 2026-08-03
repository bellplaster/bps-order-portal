import assert from "node:assert/strict";
import test from "node:test";

import {
  isAdministratorRole,
  isCustomerServiceRole,
  isInternalRole,
  isSupportedUserRole,
  parseUserRole,
  roleRequiresCustomerAccount,
  userRoleLabel,
  USER_ROLES,
} from "../functions/_shared/user-roles.js";

test("all supported portal roles are explicit", () => {
  assert.equal(isSupportedUserRole(USER_ROLES.ADMIN), true);
  assert.equal(isSupportedUserRole(USER_ROLES.CUSTOMER), true);
  assert.equal(isSupportedUserRole(USER_ROLES.CUSTOMER_SERVICE), true);
  assert.equal(isSupportedUserRole("unknown"), false);
});

test("only customer users require a debtor account", () => {
  assert.equal(roleRequiresCustomerAccount("customer"), true);
  assert.equal(roleRequiresCustomerAccount("admin"), false);
  assert.equal(roleRequiresCustomerAccount("customer_service"), false);
});

test("internal roles are separated from customer accounts", () => {
  assert.equal(isInternalRole("admin"), true);
  assert.equal(isInternalRole("customer_service"), true);
  assert.equal(isInternalRole("customer"), false);
});

test("role helpers preserve administrator and customer service boundaries", () => {
  assert.equal(isAdministratorRole("admin"), true);
  assert.equal(isAdministratorRole("customer_service"), false);
  assert.equal(isCustomerServiceRole("customer_service"), true);
  assert.equal(isCustomerServiceRole("admin"), false);
});

test("role parsing does not silently grant a privileged role", () => {
  assert.equal(parseUserRole(" CUSTOMER_SERVICE "), "customer_service");
  assert.equal(parseUserRole("not-a-role"), null);
  assert.equal(parseUserRole("not-a-role", "customer"), "customer");
});

test("roles have stable interface labels", () => {
  assert.equal(userRoleLabel("admin"), "Administrator");
  assert.equal(userRoleLabel("customer_service"), "Customer Service");
  assert.equal(userRoleLabel("customer"), "Customer");
});
