import assert from "node:assert/strict";
import test from "node:test";

import {
  assertAdministrator,
  canViewOrder,
  getOrderScope,
  isInternalTestOrder,
  orderActionPermissions,
} from "../functions/_shared/order-permissions.js";

test("administrator receives all-account order scope", () => {
  assert.equal(getOrderScope({ role: "admin", account_id: 1, is_primary: 0 }), "all");
});

test("customer service receives genuine-customer order scope without an account", () => {
  assert.equal(getOrderScope({ role: "customer_service", account_id: null, is_primary: 0 }), "staff");
});

test("primary customer receives account order scope", () => {
  assert.equal(getOrderScope({ role: "customer", account_id: 2, is_primary: 1 }), "account");
});

test("secondary customer receives own-order scope", () => {
  assert.equal(getOrderScope({ role: "customer", account_id: 2, is_primary: 0 }), "own");
});

test("administrator can view an order from another account", () => {
  assert.equal(canViewOrder(
    { id: 1, role: "admin", account_id: 1 },
    { account_id: 99, created_by_user_id: 55 },
  ), true);
});

test("customer service can view genuine orders across accounts", () => {
  const viewer = { id: 3, role: "customer_service", account_id: null };
  assert.equal(canViewOrder(viewer, {
    account_id: 99,
    created_by_user_id: 55,
    debtor_code_snapshot: "BPS BRUNSW17",
    creator_role: "customer",
  }), true);
});

test("customer service cannot view administrator test orders", () => {
  const viewer = { id: 3, role: "customer_service", account_id: null };
  assert.equal(canViewOrder(viewer, {
    account_id: 1,
    created_by_user_id: 1,
    debtor_code_snapshot: "STAFF",
    creator_role: "admin",
  }), false);
  assert.equal(isInternalTestOrder({ debtor_code_snapshot: "staff" }), true);
  assert.equal(isInternalTestOrder({ creator_role: "admin" }), true);
});

test("customer cannot view an order from another account", () => {
  assert.equal(canViewOrder(
    { id: 7, role: "customer", account_id: 2, is_primary: 1 },
    { account_id: 99, created_by_user_id: 7 },
  ), false);
});

test("secondary customer can only view orders they placed", () => {
  const viewer = { id: 7, role: "customer", account_id: 2, is_primary: 0 };
  assert.equal(canViewOrder(viewer, { account_id: 2, created_by_user_id: 7 }), true);
  assert.equal(canViewOrder(viewer, { account_id: 2, created_by_user_id: 8 }), false);
});

test("only administrators receive order-management actions", () => {
  const readOnly = {
    canEdit: false,
    canArchive: false,
    canRestore: false,
    canDelete: false,
  };
  assert.deepEqual(orderActionPermissions({ role: "customer" }, "completed"), readOnly);
  assert.deepEqual(orderActionPermissions({ role: "customer_service" }, "completed"), readOnly);
  assert.deepEqual(orderActionPermissions({ role: "admin" }, "completed"), {
    canEdit: false,
    canArchive: true,
    canRestore: false,
    canDelete: true,
  });
  assert.deepEqual(orderActionPermissions({ role: "admin" }, "archived"), {
    canEdit: false,
    canArchive: false,
    canRestore: true,
    canDelete: true,
  });
});

test("administrator assertion rejects non-administrator roles", () => {
  assert.throws(
    () => assertAdministrator({ role: "customer" }),
    (error) => error.status === 403 && /administrator/i.test(error.message),
  );
  assert.throws(
    () => assertAdministrator({ role: "customer_service" }),
    (error) => error.status === 403 && /administrator/i.test(error.message),
  );
  assert.doesNotThrow(() => assertAdministrator({ role: "admin" }));
});
