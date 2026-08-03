import assert from "node:assert/strict";
import test from "node:test";

import {
  assertAdministrator,
  canViewOrder,
  getOrderScope,
  orderActionPermissions,
} from "../functions/_shared/order-permissions.js";

test("administrator receives all-account order scope", () => {
  assert.equal(getOrderScope({ role: "admin", account_id: 1, is_primary: 0 }), "all");
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
  assert.deepEqual(orderActionPermissions({ role: "customer" }, "completed"), {
    canEdit: false,
    canArchive: false,
    canRestore: false,
    canDelete: false,
  });
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

test("administrator assertion rejects customer roles", () => {
  assert.throws(
    () => assertAdministrator({ role: "customer" }),
    (error) => error.status === 403 && /administrator/i.test(error.message),
  );
  assert.doesNotThrow(() => assertAdministrator({ role: "admin" }));
});
