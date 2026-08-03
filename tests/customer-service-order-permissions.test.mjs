import test from "node:test";
import assert from "node:assert/strict";

import {
  getOrderScope,
  orderActionPermissions,
} from "../functions/_shared/order-permissions.js";
import { effectiveUserRole } from "../functions/_shared/user-roles.js";

function customerServiceViewer() {
  return {
    id: 22,
    account_id: null,
    role: effectiveUserRole("admin", "customer_service"),
    is_primary: 0,
  };
}

test("legacy customer-service storage resolves to the customer_service role", () => {
  assert.equal(effectiveUserRole("admin", "customer_service"), "customer_service");
});

test("customer service receives the genuine-order staff scope", () => {
  assert.equal(getOrderScope(customerServiceViewer()), "staff");
});

test("customer service cannot archive, restore or permanently delete orders", () => {
  const completed = orderActionPermissions(customerServiceViewer(), "completed");
  assert.deepEqual(completed, {
    canEdit: false,
    canArchive: false,
    canRestore: false,
    canDelete: false,
  });

  const archived = orderActionPermissions(customerServiceViewer(), "archived");
  assert.deepEqual(archived, {
    canEdit: false,
    canArchive: false,
    canRestore: false,
    canDelete: false,
  });
});

test("administrator retains archive, restore and permanent deletion permissions", () => {
  const administrator = { role: "admin" };
  assert.equal(orderActionPermissions(administrator, "completed").canArchive, true);
  assert.equal(orderActionPermissions(administrator, "completed").canDelete, true);
  assert.equal(orderActionPermissions(administrator, "archived").canRestore, true);
});
