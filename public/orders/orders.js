import { fetchOrders, signOut } from "./order-service.js";

const PAGE_SIZE = 25;
const state = {
  orders: [],
  viewer: null,
  staff: [],
  accounts: [],
  page: 1,
};

const elements = {};

document.addEventListener("DOMContentLoaded", initialise);

async function initialise() {
  cacheElements();
  bindEvents();
  await loadOrders();
}

function cacheElements() {
  [
    "ordersScopeDescription",
    "ordersMessage",
    "ordersSearch",
    "customerFilterField",
    "customerFilter",
    "staffFilterField",
    "staffFilter",
    "statusFilter",
    "sortFilter",
    "refreshOrdersButton",
    "ordersCount",
    "ordersUpdated",
    "ordersTableBody",
    "ordersMobileList",
    "ordersEmpty",
    "ordersLoading",
    "ordersRange",
    "ordersPageLabel",
    "previousOrdersPage",
    "nextOrdersPage",
    "logoutButton",
    "createOrderButton",
    "orderFormLink",
    "accountLink",
  ].forEach((id) => {
    elements[id] = document.getElementById(id);
  });
}

function bindEvents() {
  elements.ordersSearch.addEventListener("input", resetAndRender);
  elements.customerFilter.addEventListener("change", () => {
    updateStaffFilterForCustomer();
    resetAndRender();
  });
  elements.staffFilter.addEventListener("change", resetAndRender);
  elements.statusFilter.addEventListener("change", resetAndRender);
  elements.sortFilter.addEventListener("change", resetAndRender);
  elements.refreshOrdersButton.addEventListener("click", loadOrders);
  elements.previousOrdersPage.addEventListener("click", () => changePage(-1));
  elements.nextOrdersPage.addEventListener("click", () => changePage(1));
  elements.logoutButton.addEventListener("click", logout);
}

async function loadOrders() {
  setBusy(true);
  clearMessage();
  try {
    const result = await fetchOrders();
    state.orders = Array.isArray(result.orders) ? result.orders : [];
    state.viewer = result.viewer || {};
    state.staff = Array.isArray(result.staff) ? result.staff : [];
    state.accounts = Array.isArray(result.accounts) ? result.accounts : [];
    state.page = 1;
    configureScope();
    renderOrders();
    elements.ordersUpdated.textContent = `Updated ${formatTime(new Date())}`;
  } catch (error) {
    state.orders = [];
    renderOrders();
    showMessage(withRequestId(error), "error");
  } finally {
    setBusy(false);
  }
}

function configureScope() {
  const scope = state.viewer?.scope || "own";
  const administrator = scope === "all";
  const customerService = scope === "staff";
  const globalScope = administrator || customerService;

  document.body.dataset.orderScope = scope;
  elements.ordersScopeDescription.textContent = administrator
    ? "View and manage orders across every customer account, including administrator tests."
    : customerService
      ? "Review genuine customer orders across every customer account and place orders on behalf of customers. Administrator test orders are excluded."
      : scope === "account"
        ? "View all orders placed under your customer account."
        : "View orders placed using your username.";

  if (elements.createOrderButton) elements.createOrderButton.hidden = false;
  if (elements.orderFormLink) elements.orderFormLink.hidden = false;
  if (elements.accountLink) elements.accountLink.hidden = customerService;

  populateCustomerFilter(globalScope);
  populateStaffFilter(scope !== "own");
}

function populateCustomerFilter(visible) {
  elements.customerFilterField.hidden = !visible;
  const selected = elements.customerFilter.value;
  elements.customerFilter.replaceChildren(option("", "All customers"));

  if (!visible) return;
  state.accounts.forEach((account) => {
    const label = [account.companyName, account.debtorCode].filter(Boolean).join(" · ");
    elements.customerFilter.append(option(String(account.id), label || `Account ${account.id}`));
  });
  if ([...elements.customerFilter.options].some((item) => item.value === selected)) {
    elements.customerFilter.value = selected;
  }
}

function populateStaffFilter(visible) {
  elements.staffFilterField.hidden = !visible;
  updateStaffFilterForCustomer();
}

function updateStaffFilterForCustomer() {
  const selected = elements.staffFilter.value;
  const accountId = Number(elements.customerFilter.value || 0);
  const staff = accountId
    ? state.staff.filter((user) => Number(user.accountId) === accountId)
    : state.staff;
  const globalScope = ["all", "staff"].includes(state.viewer?.scope);

  elements.staffFilter.replaceChildren(option("", "All users"));
  staff.forEach((user) => {
    const name = displayUsername(user.username || user.name);
    const suffix = globalScope && user.companyName ? ` · ${user.companyName}` : "";
    elements.staffFilter.append(option(String(user.id), `${name}${suffix}`));
  });

  elements.staffFilterField.hidden = state.viewer?.scope === "own" || staff.length === 0;
  if ([...elements.staffFilter.options].some((item) => item.value === selected)) {
    elements.staffFilter.value = selected;
  }
}

function resetAndRender() {
  state.page = 1;
  renderOrders();
}

function changePage(direction) {
  const orders = filteredOrders();
  const pageCount = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  state.page = Math.min(pageCount, Math.max(1, state.page + direction));
  renderOrders();
  document.querySelector(".orders-index-card")?.scrollIntoView({ block: "start" });
}

function renderOrders() {
  const orders = filteredOrders();
  const pageCount = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  if (state.page > pageCount) state.page = pageCount;

  const start = (state.page - 1) * PAGE_SIZE;
  const visible = orders.slice(start, start + PAGE_SIZE);
  elements.ordersTableBody.replaceChildren();
  elements.ordersMobileList.replaceChildren();

  visible.forEach((order) => {
    elements.ordersTableBody.append(renderOrderRow(order));
    elements.ordersMobileList.append(renderMobileOrder(order));
  });

  const empty = orders.length === 0;
  elements.ordersEmpty.hidden = !empty;
  elements.ordersCount.textContent = `${orders.length} order${orders.length === 1 ? "" : "s"}`;
  elements.ordersRange.textContent = empty
    ? "0 orders"
    : `${start + 1}–${Math.min(start + PAGE_SIZE, orders.length)} of ${orders.length}`;
  elements.ordersPageLabel.textContent = `Page ${state.page} of ${pageCount}`;
  elements.previousOrdersPage.disabled = state.page <= 1;
  elements.nextOrdersPage.disabled = state.page >= pageCount;
}

function filteredOrders() {
  const query = elements.ordersSearch.value.trim().toLowerCase();
  const accountId = Number(elements.customerFilter.value || 0);
  const staffId = Number(elements.staffFilter.value || 0);
  const status = elements.statusFilter.value;

  const filtered = state.orders.filter((order) => {
    if (accountId && Number(order.account_id) !== accountId) return false;
    if (staffId && Number(order.created_by_user_id) !== staffId) return false;
    if (status && String(order.status || "").toLowerCase() !== status) return false;
    if (!query) return true;

    const details = order.order_details || {};
    const searchable = [
      order.customer_reference,
      order.company_name,
      order.debtor_code,
      order.created_by_username,
      order.created_by_name,
      details.contact,
      details.mobile,
      details.delivery_address,
      details.delivery_instructions,
    ].join(" ").toLowerCase();
    return searchable.includes(query);
  });

  return filtered.sort((left, right) => {
    const sort = elements.sortFilter.value;
    if (sort === "oldest") return dateValue(left.created_at) - dateValue(right.created_at);
    if (sort === "required") {
      const leftDate = dateValue(`${left.order_details?.required_date || "9999-12-31"}T00:00:00`);
      const rightDate = dateValue(`${right.order_details?.required_date || "9999-12-31"}T00:00:00`);
      return leftDate - rightDate || dateValue(right.created_at) - dateValue(left.created_at);
    }
    return dateValue(right.created_at) - dateValue(left.created_at);
  });
}

function renderOrderRow(order) {
  const details = order.order_details || {};
  const row = document.createElement("tr");
  const url = orderUrl(order.submission_id);
  row.tabIndex = 0;
  row.dataset.orderUrl = url;
  row.addEventListener("click", () => window.location.assign(url));
  row.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    window.location.assign(url);
  });

  row.append(
    tableCell(orderIdentity(order), "orders-order-cell"),
    tableCell(submittedIdentity(order), "orders-submitted-cell"),
    tableCell(customerIdentity(order), "orders-customer-cell"),
    tableCell(requiredIdentity(details), "orders-required-cell"),
    tableCell(deliveryIdentity(details), "orders-delivery-cell"),
    tableCell(itemIdentity(order), "orders-number-column"),
    tableCell(statusBadge(order.status), "orders-status-column"),
    tableCell(text("span", "orders-row-arrow", "›"), "orders-open-column"),
  );
  return row;
}

function renderMobileOrder(order) {
  const details = order.order_details || {};
  const link = document.createElement("a");
  link.className = "orders-mobile-row";
  link.href = orderUrl(order.submission_id);

  const header = document.createElement("div");
  header.className = "orders-mobile-header";
  header.append(orderIdentity(order), statusBadge(order.status));

  const meta = document.createElement("div");
  meta.className = "orders-mobile-meta";
  meta.append(
    labelledValue("Customer", order.company_name || "—"),
    labelledValue("Required", requiredText(details)),
    labelledValue("Delivery", deliveryTypeLabel(details.delivery_type)),
    labelledValue("Items", `${Number(order.item_count || 0)} lines · ${Number(order.unit_count || 0)} units`),
  );
  link.append(header, meta);
  return link;
}

function orderIdentity(order) {
  const block = document.createElement("div");
  block.className = "orders-primary";
  block.append(
    text("strong", "", order.customer_reference || "No reference"),
    text("span", "", `Placed by ${displayUsername(order.created_by_username || order.created_by_name)}`),
  );
  return block;
}

function submittedIdentity(order) {
  const block = document.createElement("div");
  block.className = "orders-secondary";
  block.append(
    text("strong", "", formatDate(order.created_at)),
    text("span", "", formatClock(order.created_at)),
  );
  return block;
}

function customerIdentity(order) {
  const block = document.createElement("div");
  block.className = "orders-secondary";
  block.append(
    text("strong", "", order.company_name || "—"),
    text("span", "", order.debtor_code || ""),
  );
  return block;
}

function requiredIdentity(details) {
  const block = document.createElement("div");
  block.className = "orders-secondary";
  block.append(
    text("strong", "", formatRequiredDate(details.required_date) || "—"),
    text("span", "", timeSlotLabel(details.time_slot)),
  );
  return block;
}

function deliveryIdentity(details) {
  const block = document.createElement("div");
  block.className = "orders-secondary";
  block.append(
    text("strong", "", deliveryTypeLabel(details.delivery_type)),
    text("span", "", details.delivery_address || "No address"),
  );
  return block;
}

function itemIdentity(order) {
  const block = document.createElement("div");
  block.className = "orders-item-count";
  block.append(
    text("strong", "", String(Number(order.item_count || 0))),
    text("span", "", `${Number(order.unit_count || 0)} units`),
  );
  return block;
}

function statusBadge(value) {
  return text("span", `order-status status-${safeToken(value)}`, statusLabel(value));
}

function tableCell(content, className = "") {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  cell.append(content);
  return cell;
}

function labelledValue(label, value) {
  const item = document.createElement("div");
  item.append(text("span", "", label), text("strong", "", value || "—"));
  return item;
}

async function logout() {
  elements.logoutButton.disabled = true;
  try {
    await signOut();
  } catch (_error) {
    // Redirecting still clears the visible portal state when the session is stale.
  }
  window.location.assign("/signin/");
}

function setBusy(busy) {
  elements.ordersLoading.hidden = !busy;
  elements.refreshOrdersButton.disabled = busy;
}

function showMessage(message, stateName) {
  elements.ordersMessage.hidden = false;
  elements.ordersMessage.dataset.state = stateName;
  elements.ordersMessage.textContent = message;
}

function clearMessage() {
  elements.ordersMessage.hidden = true;
  elements.ordersMessage.textContent = "";
  delete elements.ordersMessage.dataset.state;
}

function withRequestId(error) {
  return error?.requestId ? `${error.message} Request ID: ${error.requestId}` : error?.message || String(error);
}

function option(value, label) {
  const item = document.createElement("option");
  item.value = value;
  item.textContent = label;
  return item;
}

function text(tagName, className, value) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = value == null || value === "" ? "—" : String(value);
  return element;
}

function orderUrl(submissionId) {
  return `/orders/view/?id=${encodeURIComponent(submissionId)}`;
}

function requiredText(details) {
  return [formatRequiredDate(details.required_date), timeSlotLabel(details.time_slot)].filter(Boolean).join(" · ") || "—";
}

function statusLabel(value) {
  const status = String(value || "completed").trim().toLowerCase();
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function timeSlotLabel(value) {
  const labels = { "1ST": "1st", "2ND": "2nd", AM: "AM", PM: "PM", ANY: "Any" };
  return labels[String(value || "").toUpperCase()] || "No default";
}

function deliveryTypeLabel(value) {
  const labels = {
    "Manual Unload (Knauf Labour)": "Manual unload",
    "Mechanical (Forklift/Crane/Own)": "Mechanical",
    "Mixed Unload (Hand + Machine)": "Mixed unload",
    "Pickup (Customer to collect)": "Pickup",
  };
  return labels[value] || value || "—";
}

function displayUsername(value) {
  return String(value || "Legacy order")
    .trim()
    .replace(/[._-]+/g, " ")
    .replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase("en-AU"));
}

function formatDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value || "—");
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function formatRequiredDate(value) {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function formatClock(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function formatTime(value) {
  return new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function dateValue(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function safeToken(value) {
  return String(value || "completed").toLowerCase().replace(/[^a-z0-9-]+/g, "-");
}
