import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("customer service is rendered as its own parent portal-user group", async () => {
  const source = await read("public/admin-user-management.js");

  assert.match(source, /const administrators = model\.users\.filter\(\(user\) => user\.role === ROLE_ADMIN\)/);
  assert.match(source, /const customerServiceUsers = model\.users\.filter\(\(user\) => user\.role === ROLE_CUSTOMER_SERVICE\)/);
  assert.match(source, /id: "customer-service"/);
  assert.match(source, /name: "Customer Service"/);
  assert.match(source, /debtorCode: "All customer accounts"/);
  assert.match(source, /users: customerServiceUsers/);
});

test("customer service can enter the order form but remains blocked from Account", async () => {
  const middleware = await read("functions/_middleware.js");
  const orders = await read("public/orders/orders.js");

  assert.match(middleware, /CUSTOMER_SERVICE_REDIRECT_PATHS = new Set\(\["\/account", "\/account\/"\]\)/);
  assert.doesNotMatch(middleware, /CUSTOMER_SERVICE_REDIRECT_PATHS = new Set\(\["\/"/);
  assert.match(orders, /createOrderButton\.hidden = false/);
  assert.match(orders, /orderFormLink\.hidden = false/);
  assert.match(orders, /accountLink\.hidden = customerService/);
});

test("customer service receives active genuine customer accounts for order entry", async () => {
  const accountApi = await read("functions/api/account.js");

  assert.match(accountApi, /COALESCE\(NULLIF\(u\.access_role, ''\), u\.role\) AS role/);
  assert.match(accountApi, /isCustomerServiceRole\(profile\.role\)/);
  assert.match(accountApi, /WHERE active = 1/);
  assert.match(accountApi, /UPPER\(COALESCE\(debtor_code, ''\)\) <> \?/);
  assert.match(accountApi, /ADMIN_TEST_DEBTOR_CODE = "STAFF"/);
});

test("customer service debtor selection is integrated into Order Details as an autosuggest", async () => {
  const app = await read("public/app.js");
  const css = await read("public/customer-service-ordering.css");
  const order = await read("public/app-order.js");

  assert.match(app, /customerServiceOrderAccountId: null/);
  assert.match(app, /label\.textContent = "Debtor"/);
  assert.match(app, /input\.id = "customerServiceCustomerAccount"/);
  assert.match(app, /input\.placeholder = "Debtor"/);
  assert.match(app, /filterCustomerServiceAccounts/);
  assert.match(app, /handleCustomerServiceDebtorKeydown/);
  assert.match(app, /company_name/);
  assert.match(app, /debtor_code/);
  assert.match(app, /return scored\.map\(\(item\) => item\.account\)/);
  assert.doesNotMatch(app, /scored\.slice\(0,\s*8\)/);
  assert.match(app, /tools\.hidden = true/);
  assert.doesNotMatch(app, /Place an order for a customer/);
  assert.doesNotMatch(app, /Debtor account/);
  assert.doesNotMatch(app, /customer-service-order-copy/);
  assert.match(css, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(css, /customer-service-details-grid > \.sheet-field-row\s*\{[\s\S]*?border-right:\s*0\s*!important/);
  assert.match(css, /customer-service-details-grid > \.customer-service-reference-row,[\s\S]*customer-service-details-grid > \.customer-service-contact-row[\s\S]*border-right: 1px solid #d4d9d7 !important/);
  assert.match(css, /customer-service-debtor-results[\s\S]*top: 100%;/);
  assert.doesNotMatch(css, /top: calc\(100% \+ 6px\)/);
  assert.match(css, /customer-service-debtor-option[\s\S]*min-height: 34px/);
  assert.doesNotMatch(css, /magnifier|search-icon/i);
  assert.match(order, /Choose a customer account before building the order/);
  assert.match(order, /X-BPS-Customer-Account/);
});

test("required date and saved contacts attach directly to their input", async () => {
  const date = await read("public/order-details-date-state.js");
  const contacts = await read("public/linked-contact-picker.js");

  assert.match(date, /display\.addEventListener\("focus",[\s\S]*openCalendar\(\)/);
  assert.match(date, /display\.addEventListener\("click", \(\) => openCalendar\(\)\)/);
  assert.match(date, /document\.getElementById\(BUTTON_ID\)\?\.remove\(\)/);
  assert.doesNotMatch(date, /calendar\.svg/);
  assert.match(date, /top:100%;left:0;width:292px/);
  assert.doesNotMatch(date, /top:calc\(100% \+ 6px\)/);
  assert.match(date, /border:1px solid #aebbb7;border-radius:8px/);

  assert.match(contacts, /contactInput\.addEventListener\("focus",[\s\S]*openMenu\(\)/);
  assert.match(contacts, /contactInput\.addEventListener\("click", \(\) => openMenu\(\)\)/);
  assert.doesNotMatch(contacts, /button\.id = "linkedContactButton"/);
  assert.doesNotMatch(contacts, /contact-notebook\.svg/);
  assert.match(contacts, /top:100%;left:0;width:390px/);
  assert.doesNotMatch(contacts, /top:calc\(100% \+ 6px\)/);
  assert.match(contacts, /border:1px solid #aebbb7;border-radius:8px/);
});

test("order form does not expose the base layout before account bootstrap resolves", async () => {
  const css = await read("public/order-field-behaviour.css");

  assert.match(css, /@import url\("\/customer-service-ordering\.css\?v=20260808-4"\)/);
  assert.match(css, /\.order-form-page \.order-shell \{[\s\S]*visibility: hidden;[\s\S]*opacity: 0;/);
  assert.match(css, /:has\(#accountSummary:not\(:empty\)\) \.order-shell/);
  assert.match(css, /:has\(#adminOrderTools:not\(\[hidden\]\)\) \.order-shell/);
});

test("submission endpoint authorizes the selected customer instead of impersonating it", async () => {
  const submit = await read("functions/api/submit.js");

  assert.match(submit, /isCustomerServiceRole\(actorRole\)/);
  assert.match(submit, /context\.request\.headers\.get\("X-BPS-Customer-Account"\)/);
  assert.match(submit, /FROM customer_accounts/);
  assert.match(submit, /AND active = 1/);
  assert.match(submit, /UPPER\(COALESCE\(debtor_code, ''\)\) <> \?/);
  assert.match(submit, /payload\.customerAccountId = accountId/);
  assert.match(submit, /stampOrderCreator\(context\.env\.DB, savedSubmissionId, actor\)/);
});

test("saved contacts follow the customer selected by Customer Service and stay read only", async () => {
  const api = await read("functions/api/account-contacts.js");
  const picker = await read("public/linked-contact-picker.js");

  assert.match(api, /resolveReadAccountId\(context, auth\)/);
  assert.match(api, /isCustomerServiceRole\(auth\.role\) \? false : await userCanManage/);
  assert.match(api, /url\.searchParams\.get\("accountId"\)/);
  assert.match(picker, /api\/account-contacts\?accountId=/);
  assert.match(picker, /bps:order-account-changed/);
  assert.match(picker, /customerServiceMode \? "" :/);
});
