import {
  fetchOrder,
  permanentlyDeleteOrder,
  setOrderStatus,
  signOut,
} from "../order-service.js";

const state = { result: null };
const elements = {};

document.addEventListener("DOMContentLoaded", initialise);

async function initialise() {
  cacheElements();
  bindEvents();
  const submissionId = new URLSearchParams(window.location.search).get("id") || "";
  if (!submissionId) {
    showFailure("No order was selected.");
    return;
  }

  try {
    state.result = await fetchOrder(submissionId);
    renderOrder(state.result);
  } catch (error) {
    showFailure(withRequestId(error));
  }
}

function cacheElements() {
  [
    "logoutButton",
    "orderViewMessage",
    "orderViewLoading",
    "orderViewContent",
    "orderReference",
    "orderStatus",
    "orderSubmittedMeta",
    "viewGridLink",
    "secondaryGridLink",
    "legacySnapshotNotice",
    "orderSummaryDetails",
    "orderDeliveryDetails",
    "orderProductSummary",
    "orderAreas",
    "orderFiles",
    "orderTimeline",
    "archiveOrderButton",
    "restoreOrderButton",
    "deleteOrderButton",
    "deleteOrderDialog",
    "deleteOrderForm",
    "closeDeleteDialog",
    "cancelDeleteOrder",
    "deleteOrderLabel",
    "deleteOrderConfirmation",
    "confirmDeleteOrder",
  ].forEach((id) => {
    elements[id] = document.getElementById(id);
  });
}

function bindEvents() {
  elements.logoutButton.addEventListener("click", logout);
  elements.archiveOrderButton.addEventListener("click", () => updateStatus("archive"));
  elements.restoreOrderButton.addEventListener("click", () => updateStatus("restore"));
  elements.deleteOrderButton.addEventListener("click", openDeleteDialog);
  elements.deleteOrderForm.addEventListener("submit", deleteOrder);
  elements.closeDeleteDialog.addEventListener("click", closeDeleteDialog);
  elements.cancelDeleteOrder.addEventListener("click", closeDeleteDialog);
  elements.deleteOrderDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDeleteDialog();
  });
}

function renderOrder(result) {
  const order = result.order || {};
  const snapshot = result.snapshot || {};
  const details = snapshot.details || {};
  document.title = `${order.customerReference || "Order"} | Bell Plaster Order Portal`;
  elements.orderReference.textContent = `Order ${order.customerReference || ""}`.trim();
  elements.orderStatus.className = `order-status status-${safeToken(order.status)}`;
  elements.orderStatus.textContent = statusLabel(order.status);
  elements.orderSubmittedMeta.textContent = `${order.companyName || "Customer"} · Submitted ${formatDateTime(order.createdAt)} by ${displayUsername(order.createdByUsername || order.createdByName)}`;

  const gridUrl = `/?viewOrder=${encodeURIComponent(order.submissionId)}&fromOrder=1`;
  elements.viewGridLink.href = gridUrl;
  elements.secondaryGridLink.href = gridUrl;
  elements.legacySnapshotNotice.hidden = snapshot.layoutSource !== "current";

  renderDefinitionList(elements.orderSummaryDetails, [
    ["Reference", details.reference || order.customerReference],
    ["Required date", formatRequiredDate(details.requiredDate)],
    ["Time slot", timeSlotLabel(details.timeSlot)],
    ["Delivery type", deliveryTypeLabel(details.deliveryType)],
    ["Product lines", String(Number(snapshot.totals?.lineCount || 0))],
    ["Total units", String(Number(snapshot.totals?.unitCount || 0))],
  ]);

  renderDefinitionList(elements.orderDeliveryDetails, [
    ["Contact", details.contact || "—"],
    ["Phone", details.mobile || "—"],
    ["Address", details.deliveryAddress || [details.addressLine1, details.addressLine2].filter(Boolean).join(", ") || "—"],
    ["Extras", (details.extras || []).join(", ") || "None"],
    ["Instructions", details.deliveryInstructions || "—"],
    ["Placed under", [order.companyName, order.debtorCode].filter(Boolean).join(" · ") || "—"],
  ]);

  elements.orderProductSummary.textContent = `${Number(snapshot.totals?.lineCount || 0)} product lines across ${Number(snapshot.totals?.areaCount || 0)} delivery area${Number(snapshot.totals?.areaCount || 0) === 1 ? "" : "s"}.`;
  renderAreas(snapshot.areas || []);
  renderFiles(result.files || []);
  renderTimeline(result.events || []);

  elements.archiveOrderButton.hidden = order.canArchive !== true;
  elements.restoreOrderButton.hidden = order.canRestore !== true;
  elements.deleteOrderButton.hidden = order.canDelete !== true;
  elements.orderViewLoading.hidden = true;
  elements.orderViewContent.hidden = false;
}

function renderDefinitionList(root, rows) {
  root.replaceChildren();
  rows.forEach(([label, value]) => {
    const row = document.createElement("div");
    const term = document.createElement("dt");
    const definition = document.createElement("dd");
    term.textContent = label;
    definition.textContent = value || "—";
    row.append(term, definition);
    root.append(row);
  });
}

function renderAreas(areas) {
  elements.orderAreas.replaceChildren();
  if (!areas.length) {
    elements.orderAreas.append(emptyState("No submitted product lines were found."));
    return;
  }

  areas.forEach((area, areaIndex) => {
    const details = document.createElement("details");
    details.className = "order-area";
    details.open = areaIndex === 0;

    const summary = document.createElement("summary");
    const title = document.createElement("div");
    title.className = "order-area-title";
    const lineCount = (area.items || []).length + (area.otherMaterials || []).length;
    const unitCount = [...(area.items || []), ...(area.otherMaterials || [])]
      .reduce((total, item) => total + Number(item.quantity || 0), 0);
    title.append(
      text("strong", area.label || `Area ${areaIndex + 1}`),
      text("span", `${lineCount} lines · ${unitCount} units`),
    );
    summary.append(title);

    const body = document.createElement("div");
    body.className = "order-area-body";
    const groups = groupAreaLines(area);
    groups.forEach((lines, sectionName) => body.append(renderProductSection(sectionName, lines)));
    if (area.otherProducts) body.append(text("p", "order-area-note", area.otherProducts));
    details.append(summary, body);
    elements.orderAreas.append(details);
  });
}

function groupAreaLines(area) {
  const groups = new Map();
  (area.items || []).forEach((item) => addGroupLine(groups, item.section || "Products", {
    label: item.label || item.key,
    description: item.description || "",
    sku: item.sku || "",
    quantity: Number(item.quantity || 0),
  }));
  (area.otherMaterials || []).forEach((item) => addGroupLine(groups, "Additional products", {
    label: item.description || item.sku,
    description: item.description || "",
    sku: item.sku || "",
    quantity: Number(item.quantity || 0),
  }));
  return groups;
}

function addGroupLine(groups, section, line) {
  if (!groups.has(section)) groups.set(section, []);
  groups.get(section).push(line);
}

function renderProductSection(title, lines) {
  const section = document.createElement("section");
  section.className = "order-section";
  section.append(text("h3", "", title));

  const table = document.createElement("table");
  table.className = "order-lines-table";
  table.innerHTML = "<thead><tr><th>Product</th><th>SKU</th><th class=\"line-quantity\">Quantity</th></tr></thead>";
  const body = document.createElement("tbody");
  lines.forEach((line) => {
    const row = document.createElement("tr");
    const productCell = document.createElement("td");
    const product = document.createElement("div");
    product.className = "line-product";
    product.append(text("strong", "", line.label || "Product"));
    if (line.description && line.description !== line.label) product.append(text("span", "", line.description));
    productCell.append(product);
    row.append(productCell, text("td", "", line.sku || "—"), text("td", "line-quantity", String(line.quantity)));
    body.append(row);
  });
  table.append(body);
  section.append(table);
  return section;
}

function renderFiles(files) {
  elements.orderFiles.replaceChildren();
  if (!files.length) {
    elements.orderFiles.append(emptyState("No downloadable files are available."));
    return;
  }

  files.forEach((file) => {
    const link = document.createElement("a");
    link.className = "order-file";
    link.href = file.download_url;
    link.download = file.filename || "";
    const identity = document.createElement("div");
    identity.append(
      text("strong", "", file.floor_label || file.floor || "Order file"),
      text("span", "", file.filename || "Excel file"),
    );
    link.append(identity, text("b", "", "Download XLSX"));
    elements.orderFiles.append(link);
  });
}

function renderTimeline(events) {
  elements.orderTimeline.replaceChildren();
  if (!events.length) {
    elements.orderTimeline.append(emptyState("No activity has been recorded."));
    return;
  }

  events.slice(0, 12).forEach((event) => {
    const item = document.createElement("li");
    item.append(text("strong", "", event.stage || "Order updated"), text("span", "", formatDateTime(event.created_at)));
    elements.orderTimeline.append(item);
  });
}

async function updateStatus(action) {
  const order = state.result?.order;
  if (!order) return;
  const verb = action === "archive" ? "Archive" : "Restore";
  if (!window.confirm(`${verb} order ${order.customerReference}?`)) return;

  try {
    await setOrderStatus(order.submissionId, action);
    state.result = await fetchOrder(order.submissionId);
    renderOrder(state.result);
    showMessage(`Order ${order.customerReference} was ${action === "archive" ? "archived" : "restored"}.`, "success");
  } catch (error) {
    showMessage(withRequestId(error), "error");
  }
}

function openDeleteDialog() {
  const reference = state.result?.order?.customerReference || "";
  elements.deleteOrderLabel.textContent = `Type ${reference} to confirm`;
  elements.deleteOrderConfirmation.value = "";
  elements.deleteOrderDialog.showModal();
  elements.deleteOrderConfirmation.focus();
}

function closeDeleteDialog() {
  elements.deleteOrderConfirmation.value = "";
  elements.deleteOrderDialog.close();
}

async function deleteOrder(event) {
  event.preventDefault();
  const order = state.result?.order;
  if (!order) return;
  if (elements.deleteOrderConfirmation.value.trim() !== String(order.customerReference || "").trim()) {
    elements.deleteOrderConfirmation.setCustomValidity("The reference does not match.");
    elements.deleteOrderConfirmation.reportValidity();
    elements.deleteOrderConfirmation.setCustomValidity("");
    return;
  }

  elements.confirmDeleteOrder.disabled = true;
  try {
    await permanentlyDeleteOrder(order.submissionId);
    window.location.assign("/orders/");
  } catch (error) {
    showMessage(withRequestId(error), "error");
    elements.confirmDeleteOrder.disabled = false;
  }
}

async function logout() {
  elements.logoutButton.disabled = true;
  try { await signOut(); } catch (_error) { }
  window.location.assign("/signin/");
}

function showFailure(message) {
  elements.orderViewLoading.hidden = true;
  showMessage(message, "error");
}

function showMessage(message, stateName) {
  elements.orderViewMessage.hidden = false;
  elements.orderViewMessage.dataset.state = stateName;
  elements.orderViewMessage.textContent = message;
}

function emptyState(message) {
  return text("div", "order-empty", message);
}

function text(tagName, className, value) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = value == null || value === "" ? "—" : String(value);
  return element;
}

function withRequestId(error) {
  return error?.requestId ? `${error.message} Request ID: ${error.requestId}` : error?.message || String(error);
}

function statusLabel(value) {
  const status = String(value || "completed").trim().toLowerCase();
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function timeSlotLabel(value) {
  const labels = { "1ST": "1st", "2ND": "2nd", AM: "AM", PM: "PM", ANY: "Any" };
  return labels[String(value || "").toUpperCase()] || "Not selected";
}

function deliveryTypeLabel(value) {
  const labels = {
    "Manual Unload (Knauf Labour)": "Manual unload",
    "Mechanical (Forklift/Crane/Own)": "Mechanical",
    "Mixed Unload (Hand + Machine)": "Mixed unload",
    "Pickup (Customer to collect)": "Pickup",
  };
  return labels[value] || value || "Not selected";
}

function displayUsername(value) {
  return String(value || "Legacy order")
    .trim()
    .replace(/[._-]+/g, " ")
    .replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase("en-AU"));
}

function formatRequiredDate(value) {
  if (!value) return "—";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", year: "numeric" }).format(parsed);
}

function formatDateTime(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value || "Unknown time");
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function safeToken(value) {
  return String(value || "completed").toLowerCase().replace(/[^a-z0-9-]+/g, "-");
}
