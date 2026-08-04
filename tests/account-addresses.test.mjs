import test from "node:test";
import assert from "node:assert/strict";

import { cleanAddressInput } from "../functions/api/account-addresses.js";

test("saved addresses are normalised into a Victorian formatted address", () => {
  const address = cleanAddressInput({
    label: "  Site Office  ",
    street: "  125 Sussex Street ",
    suburb: " Pascoe   Vale ",
    postcode: "3044",
    isDefault: true,
  });

  assert.deepEqual(address, {
    label: "Site Office",
    street: "125 Sussex Street",
    suburb: "Pascoe Vale",
    state: "VIC",
    postcode: "3044",
    formattedAddress: "125 Sussex Street, Pascoe Vale VIC 3044",
    isDefault: true,
  });
});

test("saved addresses reject non-Victorian postcodes", () => {
  assert.throws(
    () => cleanAddressInput({ label: "Sydney", street: "1 George Street", suburb: "Sydney", postcode: "2000" }),
    /valid Victorian postcode/,
  );
});

test("saved addresses require a reusable address name", () => {
  assert.throws(
    () => cleanAddressInput({ street: "125 Sussex Street", suburb: "Pascoe Vale", postcode: "3044" }),
    /Enter an address name/,
  );
});
