import {
  fetchOrders,
  permanentlyDeleteOrder,
  setOrderStatus,
  signOut,
} from "./order-service.js";

const state = {
  orders: [],
  viewer: null,
  staff: [],
  accounts: [],
  pendingDelete: null,
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
    "refreshOrdersButton",
    "ordersCount",
    "ordersUpdated",
    "ordersList",
    "logoutButton",
    "deleteOrderDialog",
    "deleteOrderForm",
    "deleteOrderMessage",
    "deleteOrderLabel",
    "deleteOrderConfirmation",
    "confirmDeleteOrder",
    "closeDeleteDialog",
    "cancelDeleteOrder",
  ].forEach((id) => {
    elements[id] = document.getElementById(id);
  });
}

function bindEvents() {
  elements.ordersSearch.addEventListener("input", renderOrders);
  elements.customerFilter.addEventListener("change", () => {
    updateStaffFilterForCustomer();
    renderOrders();
  });
  elements.staffFilter.addEventListener("change", renderOrders);
  elements.statusFilter.addEventListener("change", renderOrders);
  elements.refreshOrdersButton.addEventListener("click", loadOrders);
  elements.logoutButton.addEventListener("click", logout);
  elements.deleteOrderForm.addEventListener("submit", confirmPermanentDelete);
  elements.closeDeleteDialog.addEventListener("click", closeDeleteDialog);
  elements.cancelDeleteOrder.addEventListener("click", closeDeleteDialog);
  elements.deleteOrderDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDeleteDialog();
  });
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
    configureScope();
    renderOrders();
    elements.ordersUpdated.textContent = `Updated ${formatTime(new Date())}`;
  } catch (error) {
    state.orders = [];
    elements.ordersList.replaceChildren(emptyState(error.message || String(error)));
    showMessage(withRequestId(error), "error");
  } finally {
    setBusy(false);
  }
}

function configureScope() {
  const scope = state.viewer?.scope || "own";
  const administrator = scope === "all";
  elements.ordersScopeDescription.textContent = administrator
    ? "View and manage orders across every customer account."
    : scope === "account"
      ? "View all orders placed under your customer account."
      : "View orders placed using your username.";

  populateCustomerFilter(administrator);
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

  elements.staffFilter.replaceChildren(option("", "All staff"));
  staff.forEach((user) => {
    const name = displayUsername(user.username || user.name);
    const suffix = state.viewer?.scope === "all" && user.companyName ? ` · ${user.companyName}` : "";
    elements.staffFilter.append(option(String(user.id), `${name}${suffix}`));
  });

  elements.staffFilterField.hidden = state.viewer?.scope === "own" || staff.length === 0;
  if ([...elements.staffFilter.options].some((item) => item.value === selected)) {
    elements.staffFilter.value = selected;
  }
}

function renderOrders() {
  const orders = filteredOrders();
  elements.ordersCount.textContent = `${orders.length} order${orders.length === 1 ? "" : "s"}`;
  elements.ordersList.replaceChildren();

  if (!orders.length) {
    elements.ordersList.append(emptyState("No orders match the current filters."));
    return;
  }

  const fragment = document.createDocumentFragment();
  orders.forEach((order) => fragment.append(renderOrderCard(order)));
  elements.ordersList.append(fragment);
}

function filteredOrders() {
  const query = elements.ordersSearch.value.trim().toLowerCase();
  const accountId = Number(elements.customerFilter.value || 0);
  const staffId = Number(elements.staffFilter.value || 0);
  const status = elements.statusFilter.value;

  return state.orders.filter((order) => {
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
}

function renderOrderCard(order) {
  const details = order.order_details || {};
  const archived = String(order.status || "").toLowerCase() === "archived";
  const card = node("article", `order-card${archived ? " is-archived" : ""}`);

  const header = node("header", "order-card-header");
  const identity = node("div");
  identity.append(
    textNode("span", "order-card-customer", [order.company_name, order.debtor_code].filter(Boolean).join(" · ") || "Customer"),
  );
  const title = node("h2", "order-card-title");
  title.append(
    textNode("strong", "", order.customer_reference || "No reference"),
    textNode("span", "", `Created by ${displayUsername(order.created_by_username || order.created_by_name)} · ${formatDateTime(order.created_at)}`),
  );
  identity.append(title);
  header.append(
    identity,
    textNode("span", `order-status status-${safeToken(order.status)}`, statusLabel(order.status)),
  );

  const body = node("dl", "order-card-body");
  [
    ["Required", joinValues(formatDate(details.required_date), timeSlotLabel(details.time_slot))],
    ["Delivery", deliveryTypeLabel(details.delivery_type)],
    ["Address", details.delivery_address || "—"],
    ["Contact", joinValues(details.contact, details.mobile)],
  ].forEach(([label, value]) => {
    const item = node("div", "order-detail");
    item.append(textNode("dt", "", label), textNode("dd", "", value || "—"));
    body.append(item);
  });

  const footer = node("footer", "order-card-footer");
  const files = node("div", "order-files");
  const latestFiles = latestFilesByArea(order.files || []);
  latestFiles.forEach((file, index) => {
    const link = textNode("a", "", latestFiles.length === 1 ? "Download Excel" : `Download ${file.floor_label || file.floor || index + 1}`);
    link.href = file.download_url;
    link.download = file.filename || "";
    files.append(link);
  });
  if (!latestFiles.length) files.append(textNode("span", "", "No file available"));

  const actions = node("div", "order-actions");
  if (order.can_archive) {
    actions.append(actionButton("Archive", "neutral", () => changeOrderStatus(order, "archive")));
  }
  if (order.can_restore) {
    actions.append(actionButton("Restore", "neutral", () => changeOrderStatus(order, "restore")));
  }
  if (order.can_delete) {
    actions.append(actionButton("Delete order", "danger", () => openDeleteDialog(order)));
  }

  footer.append(files, actions);
  card.append(header, body, footer);
  return card;
}

async function changeOrderStatus(order, action) {
  const verb = action === "archive" ? "Archive" : "Restore";
  const confirmed = window.confirm(`${verb} order ${order.customer_reference}?`);
  if (!confirmed) return;

  clearMessage();
  try {
    await setOrderStatus(order.submission_id, action);
    showMessage(`Order ${order.customer_reference} was ${action === "archive" ? "archived" : "restored"}.`, "success");
    await loadOrders();
  } catch (error) {
    showMessage(withRequestId(error), "error");
  }
}

function openDeleteDialog(order) {
  state.pendingDelete = order;
  elements.deleteOrderMessage.textContent = `This permanently removes order ${order.customer_reference}, its history record and stored Excel files. This cannot be undone.`;
  elements.deleteOrderLabel.textContent = `Type ${order.customer_reference} to confirm`;
  elements.deleteOrderConfirmation.value = "";
  elements.deleteOrderDialog.showModal();
  window.setTimeout(() => elements.deleteOrderConfirmation.focus(), 0);
}

function closeDeleteDialog() {
  state.pendingDelete = null;
  elements.deleteOrderConfirmation.value = "";
  elements.deleteOrderDialog.close();
}

async function confirmPermanentDelete(event) {
  event.preventDefault();
  const order = state.pendingDelete;
  if (!order) return;

  if (elements.deleteOrderConfirmation.value.trim() !== String(order.customer_reference || "").trim()) {
    elements.deleteOrderConfirmation.setCustomValidity("The reference does not match.");
    elements.deleteOrderConfirmation.reportValidity();
    elements.deleteOrderConfirmation.setCustomValidity("");
    return;
  }

  elements.confirmDeleteOrder.disabled = true;
  try {
    await permanentlyDeleteOrder(order.submission_id);
    closeDeleteDialog();
    showMessage(`Order ${order.customer_reference} was permanently deleted.`, "success");
    await loadOrders();
  } catch (error) {
    showMessage(withRequestId(error), "error");
  } finally {
    elements.confirmDeleteOrder.disabled = false;
  }
}

async function logout() {
  elements.logoutButton.disabled = true;
  try {
    await signOut();
  } catch (_error) {
    // A stale session may already be invalid. Redirecting still clears the visible portal state.
  }
  window.location.assign("/login/");
}

function latestFilesByArea(files) {
  const latest = new Map();
  files.forEach((file) => {
    const key = String(file.floor || file.floor_label || "combined");
    if (!latest.has(key)) latest.set(key, file);
  });
  return [...latest.values()];
}

function setBusy(busy) {
  elements.ordersList.setAttribute("aria-busy", String(busy));
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

function emptyState(message) {
  return textNode("div", "orders-empty", message);
}

function actionButton(label, className, handler) {
  const button = textNode("button", `order-action ${className}`.trim(), label);
  button.type = "button";
  button.addEventListener("click", handler);
  return button;
}

function option(value, label) {
  const item = document.createElement("option");
  item.value = value;
  item.textContent = label;
  return item;
}

function node(tagName, className = "") {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  return element;
}

function textNode(tagName, className, value) {
  const element = node(tagName, className);
  element.textContent = value == null || value === "" ? "—" : String(value);
  return element;
}

function joinValues(...values) {
  return values.map((value) => String(value || "").trim()).filter(Boolean).join(" · ") || "—";
}

function statusLabel(value) {
  const status = String(value || "completed").trim().toLowerCase();
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function timeSlotLabel(value) {
  const labels = { "1ST": "1st Load", "2ND": "2nd Load", AM: "AM", PM: "PM", ANY: "Anytime" };
  return labels[String(value || "").toUpperCase()] || String(value || "Anytime");
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
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function formatDateTime(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value || "Unknown time");
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
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

function safeToken(value) {
  return String(value || "completed").toLowerCase().replace(/[^a-z0-9-]+/g, "-");
}
