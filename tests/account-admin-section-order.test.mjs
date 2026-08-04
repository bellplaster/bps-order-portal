import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("administrator saved-address updates preserve the approved section order", async () => {
  const source = await read("public/account-experience-v2.js");
  const start = source.indexOf("function desiredSections()");
  const end = source.indexOf("function reorderSections()", start);
  const desiredSections = source.slice(start, end);

  assert.ok(start >= 0 && end > start, "desiredSections must remain explicit and testable");
  assert.match(desiredSections, /profile\?\.role === "admin"/);

  const adminOrder = desiredSections.match(/\? \[([^\]]+)\]/)?.[1] || "";
  const addressesIndex = adminOrder.indexOf("savedAddresses");
  const defaultsIndex = adminOrder.indexOf("accountForm");
  const administrationIndex = adminOrder.indexOf("adminSection");

  assert.ok(addressesIndex >= 0, "administrator order must include Saved addresses");
  assert.ok(defaultsIndex > addressesIndex, "Saved addresses must remain above Order defaults for administrators");
  assert.ok(administrationIndex > defaultsIndex, "Order defaults must remain above Administration");
});

test("customer Account section order remains unchanged", async () => {
  const source = await read("public/account-experience-v2.js");
  const start = source.indexOf("function desiredSections()");
  const end = source.indexOf("function reorderSections()", start);
  const desiredSections = source.slice(start, end);
  const customerOrder = desiredSections.match(/: \[([^\]]+)\]/)?.[1] || "";

  assert.ok(customerOrder.indexOf("accountForm") < customerOrder.indexOf("savedContacts"));
  assert.ok(customerOrder.indexOf("savedContacts") < customerOrder.indexOf("savedAddresses"));
});
