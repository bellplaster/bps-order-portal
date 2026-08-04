from pathlib import Path
import re

account = Path("functions/api/account.js")
text = account.read_text()
phone_import = 'import { normaliseAustralianPhone } from "../_shared/phone.js";\n'
validation_import = '''import {
  cleanAustralianPostcode,
  cleanInstructions,
  cleanPersonName,
  cleanReference,
  cleanStreetAddress,
  cleanSuburb,
} from "../_shared/account-field-validation.js";
'''
if "account-field-validation.js" not in text:
    text = text.replace(phone_import, phone_import + validation_import)
text = text.replace(
    "const defaultContactName = cleanOptional(body.defaultContactName ?? user.default_contact_name, 100);",
    'const defaultContactName = cleanPersonName(body.defaultContactName ?? user.default_contact_name, { optional: true, maxLength: 100, label: "Contact name" });',
)
start = text.index("export function cleanOrderDefaults(input) {")
end = text.index("\nfunction parseOrderDefaults", start)
replacement = '''export function cleanOrderDefaults(input) {
  const source = input && typeof input === "object" ? input : {};
  const requiredDate = /^\\d{4}-\\d{2}-\\d{2}$/.test(String(source.requiredDate || "")) ? String(source.requiredDate) : "";
  const postcode = cleanAustralianPostcode(source.postcode, { optional: true, victorian: true, label: "Default postcode" });
  const timeSlot = String(source.timeSlot || "").trim().toUpperCase();
  if (!TIME_SLOTS.has(timeSlot)) throw badRequest("Choose a valid default time slot.");
  const deliveryType = String(source.deliveryType || "");
  if (!DELIVERY_TYPES.has(deliveryType)) throw badRequest("Choose a valid default delivery type.");
  const extras = [...new Set((Array.isArray(source.extras) ? source.extras : []).map(String).filter((value) => DELIVERY_EXTRAS.has(value)))];
  return {
    reference: cleanReference(source.reference, { optional: true, maxLength: 80, label: "Default reference" }),
    requiredDate,
    street: cleanStreetAddress(source.street, { optional: true, maxLength: 240, label: "Default street address" }),
    suburb: cleanSuburb(source.suburb, { optional: true, maxLength: 120, label: "Default suburb" }),
    state: "VIC",
    postcode,
    timeSlot,
    deliveryType,
    extras,
    instructions: cleanInstructions(source.instructions, 1500),
  };
}
'''
account.write_text(text[:start] + replacement + text[end:])

addresses = Path("functions/api/account-addresses.js")
text = addresses.read_text()
if "account-field-validation.js" not in text:
    text = text.replace(
        'import { json } from "../_shared/responses.js";\n',
        '''import {
  cleanAddressLabel,
  cleanAustralianPostcode,
  cleanStreetAddress,
  cleanSuburb,
} from "../_shared/account-field-validation.js";
import { json } from "../_shared/responses.js";
''',
    )
old = '''  const label = cleanText(source.label, 80);
  const street = cleanText(source.street || source.addressLine1, 240);
  const suburb = cleanText(source.suburb, 120);
  const postcode = String(source.postcode || "").replace(/\\D/g, "").slice(0, 4);

  if (!label) throw badRequest("Enter an address name, such as Site office or Warehouse.");
  if (!street) throw badRequest("Enter the street address.");
  if (!suburb) throw badRequest("Enter the suburb.");
  if (!/^(?:3\\d{3}|8\\d{3})$/.test(postcode)) throw badRequest("Enter a valid Victorian postcode.");
'''
new = '''  const label = cleanAddressLabel(source.label, { maxLength: 80, label: "Address name" });
  const street = cleanStreetAddress(source.street || source.addressLine1, { maxLength: 240, label: "Street address" });
  const suburb = cleanSuburb(source.suburb, { maxLength: 120, label: "Suburb" });
  const postcode = cleanAustralianPostcode(source.postcode, { victorian: true, label: "Postcode" });
'''
if old not in text:
    raise SystemExit("account-addresses clean block not found")
addresses.write_text(text.replace(old, new))

contacts = Path("functions/api/account-contacts.js")
text = contacts.read_text()
if "account-field-validation.js" not in text:
    text = text.replace(
        'import { normaliseAustralianPhone } from "../_shared/phone.js";\n',
        'import { cleanPersonName } from "../_shared/account-field-validation.js";\nimport { normaliseAustralianPhone } from "../_shared/phone.js";\n',
    )
old = '''function cleanName(value) {
  const name = String(value || "").trim().replace(/\\s+/g, " ").slice(0, 100);
  if (!name) throw badRequest("Enter a contact name.");
  return name;
}'''
new = '''function cleanName(value) {
  return cleanPersonName(value, { maxLength: 100, label: "Contact name" });
}'''
if old not in text:
    raise SystemExit("account-contacts cleanName block not found")
contacts.write_text(text.replace(old, new))

page = Path("public/account/index.html")
text = page.read_text()
if "account-field-validation.css" not in text:
    match = re.search(r'(  <link rel="stylesheet" href="/account-interaction-polish\.css\?v=[^"]+">\n)', text)
    if not match:
        raise SystemExit("Account interaction stylesheet tag not found")
    text = text[:match.end()] + '  <link rel="stylesheet" href="/account-field-validation.css?v=20260804-1">\n' + text[match.end():]
text = text.replace(
    '<input id="defaultReference" type="text" inputmode="text" pattern="[0-9]+(?:-[0-9]+)*" maxlength="30" autocomplete="off">',
    '<input id="defaultReference" type="text" inputmode="numeric" pattern="[0-9]+(?:-[0-9]+)*" maxlength="30" autocomplete="off" title="Use numbers and single hyphens only.">',
)
text = text.replace(
    '<input id="defaultContactName" maxlength="100" autocomplete="name">',
    '<input id="defaultContactName" maxlength="100" autocomplete="name" autocapitalize="words">',
)
text = text.replace(
    '<input id="defaultStreet" maxlength="240" autocomplete="off">',
    '<input id="defaultStreet" maxlength="240" autocomplete="off" autocapitalize="words">',
)
text = text.replace(
    '<input id="defaultSuburb" maxlength="120" autocomplete="off">',
    '<input id="defaultSuburb" maxlength="120" autocomplete="off" autocapitalize="words">',
)
text = text.replace(
    '<input id="defaultPostcode" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" autocomplete="off">',
    '<input id="defaultPostcode" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" autocomplete="off" title="Enter a valid four-digit Victorian postcode.">',
)
if "account-field-validation.js" not in text:
    marker = '  <script src="/account.js?v=20260803-1" defer></script>\n'
    if marker not in text:
        raise SystemExit("account.js tag not found")
    text = text.replace(marker, '  <script src="/account-field-validation.js?v=20260804-1" defer></script>\n' + marker)
page.write_text(text)

package = Path("package.json")
text = package.read_text()
if "public/account-field-validation.js" not in text:
    text = text.replace(
        "node --check public/account.js &&",
        "node --check public/account.js && node --check public/account-field-validation.js &&",
    )
if "functions/_shared/account-field-validation.js" not in text:
    text = text.replace(
        "node --check functions/_shared/auth.js &&",
        "node --check functions/_shared/auth.js && node --check functions/_shared/account-field-validation.js &&",
    )
package.write_text(text)
