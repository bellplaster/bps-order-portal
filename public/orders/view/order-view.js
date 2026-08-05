import {
  fetchOrder,
  permanentlyDeleteOrder,
  setOrderStatus,
  signOut,
} from "../order-service.js";

const state = { result: null, activeAreaIndex: 0 };
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
    "printOrderButton",
    "orderViewMessage",
    "orderViewLoading",
    "orderViewContent",
    "orderReference",
    "orderStatus",
    "orderSubmittedMeta",
    "viewGridLink",
    "legacySnapshotNotice",
    "orderFulfilmentSummary",
    "orderProductSummary",
    "orderAreas",
    "orderDeliveryAddress",
    "orderSummaryDetails",
    "orderInstructionsBlock",
    "orderInstructions",
    "orderFilesCard",
    "orderFiles",
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
  elements.printOrderButton.addEventListener("click", () => window.print());
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
  const viewerRole = String(result.viewer?.role || "").toLowerCase();
  const internalViewer = viewerRole === "admin" || viewerRole === "customer_service";
  const productLines = Number(snapshot.totals?.lineCount || 0);
  const totalUnits = Number(snapshot.totals?.unitCount || 0);
  const areaCount = Number(snapshot.totals?.areaCount || 0);

  document.title = `${order.customerReference || "Order"} | Bell Plaster Order Portal`;
  elements.orderReference.textContent = `Order ${order.customerReference || ""}`.trim();
  elements.orderStatus.className = `order-status status-${safeToken(order.status)}`;
  elements.orderStatus.textContent = statusLabel(order.status);
  elements.orderSubmittedMeta.textContent = `Submitted ${formatDateTime(order.createdAt)} by ${displayActorName(order.createdByUsername || order.createdByName)}`;

  elements.viewGridLink.href = `/?viewOrder=${encodeURIComponent(order.submissionId)}&fromOrder=1`;
  elements.legacySnapshotNotice.hidden = snapshot.layoutSource !== "current";

  renderFulfilmentSummary(elements.orderFulfilmentSummary, details);
  renderDeliveryAddress(elements.orderDeliveryAddress, details);
  renderDefinitionList(elements.orderSummaryDetails, [
    ["Reference", details.reference || order.customerReference],
    ["Placed under", [displayCompanyName(order.companyName), String(order.debtorCode || "").toUpperCase()].filter(Boolean).join(" · ") || "—"],
    ["Product lines", String(productLines)],
    ["Total units", String(totalUnits)],
  ]);

  const instructions = String(details.deliveryInstructions || "").trim();
  elements.orderInstructionsBlock.hidden = !instructions;
  elements.orderInstructions.textContent = instructions;

  elements.orderProductSummary.textContent = `${productLines} product line${productLines === 1 ? "" : "s"} across ${areaCount} tab${areaCount === 1 ? "" : "s"}.`;
  state.activeAreaIndex = 0;
  renderAreas(snapshot.areas || []);

  elements.orderFilesCard.hidden = !internalViewer;
  if (internalViewer) renderFiles(result.files || []);

  elements.archiveOrderButton.hidden = order.canArchive !== true;
  elements.restoreOrderButton.hidden = order.canRestore !== true;
  elements.deleteOrderButton.hidden = order.canDelete !== true;
  elements.orderViewLoading.hidden = true;
  elements.orderViewContent.hidden = false;
}

function renderFulfilmentSummary(root, details) {
  root.replaceChildren();
  const required = [
    formatRequiredDate(details.requiredDate),
    timeSlotLabel(details.timeSlot),
  ].filter((value) => value && value !== "—" && value !== "Not selected").join(" · ") || "Not selected";

  [
    ["Delivery", deliveryTypeLabel(details.deliveryType)],
    ["Required", required],
    ["Extras", (details.extras || []).join(", ") || "None"],
  ].forEach(([label, value]) => {
    const item = document.createElement("div");
    item.append(text("span", "", label), text("strong", "", value));
    root.append(item);
  });
}

function renderDeliveryAddress(root, details) {
  root.replaceChildren();
  const contact = String(details.contact || "").trim();
  const phone = String(details.mobile || "").trim();
  const addressLines = deliveryAddressParts(details);
  const addressQuery = addressLines.join(", ");

  if (contact) root.append(text("strong", "order-address-name", contact));

  const address = document.createElement("address");
  address.className = "order-address-lines";
  if (addressLines.length) {
    addressLines.forEach((line) => address.append(text("span", "", line)));
  } else {
    address.append(text("span", "", "No delivery address provided"));
  }
  root.append(address);

  if (phone) {
    const phoneLink = document.createElement("a");
    phoneLink.className = "order-address-phone";
    phoneLink.href = `tel:${phone.replace(/[^\d+]/g, "")}`;
    phoneLink.textContent = phone;
    root.append(phoneLink);
  }

  if (addressQuery) {
    const mapLink = document.createElement("a");
    mapLink.className = "order-address-map";
    mapLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressQuery)}`;
    mapLink.target = "_blank";
    mapLink.rel = "noopener noreferrer";
    mapLink.textContent = "View map";
    root.append(mapLink);
  }
}

function deliveryAddressParts(details) {
  const combined = String(details.deliveryAddress || "").trim();
  if (combined) return combined.split(/\s*,\s*/).map((part) => part.trim()).filter(Boolean);
  return [details.addressLine1, details.addressLine2]
    .map((part) => String(part || "").trim())
    .filter(Boolean);
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

  const tabs = document.createElement("div");
  tabs.className = "order-area-tabs";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Delivery area tabs");

  const panels = document.createElement("div");
  panels.className = "order-area-panels";

  areas.forEach((area, areaIndex) => {
    const label = areaTabLabel(area, areaIndex);
    const lineCount = (area.items || []).length + (area.otherMaterials || []).length;
    const unitCount = [...(area.items || []), ...(area.otherMaterials || [])]
      .reduce((total, item) => total + Number(item.quantity || 0), 0);
    const tabId = `order-area-tab-${areaIndex}`;
    const panelId = `order-area-panel-${areaIndex}`;

    const tab = document.createElement("button");
    tab.type = "button";
    tab.id = tabId;
    tab.className = "order-area-tab";
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", panelId);
    tab.setAttribute("aria-selected", areaIndex === state.activeAreaIndex ? "true" : "false");
    tab.tabIndex = areaIndex === state.activeAreaIndex ? 0 : -1;
    tab.append(text("strong", "", label), text("span", "", `${lineCount} lines · ${unitCount} units`));
    tab.addEventListener("click", () => activateArea(areaIndex));
    tab.addEventListener("keydown", (event) => navigateAreaTabs(event, areaIndex, areas.length));
    tabs.append(tab);

    const panel = document.createElement("section");
    panel.id = panelId;
    panel.className = "order-area-panel";
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", tabId);
    panel.hidden = areaIndex !== state.activeAreaIndex;
    panel.append(text("h3", "order-print-area-title", label), renderAreaTable(area));
    if (area.otherProducts) panel.append(text("p", "order-area-note", area.otherProducts));
    panels.append(panel);
  });

  elements.orderAreas.append(tabs, panels);
}

function activateArea(index) {
  state.activeAreaIndex = index;
  elements.orderAreas.querySelectorAll("[role=tab]").forEach((tab, tabIndex) => {
    const active = tabIndex === index;
    tab.setAttribute("aria-selected", active ? "true" : "false");
    tab.tabIndex = active ? 0 : -1;
  });
  elements.orderAreas.querySelectorAll("[role=tabpanel]").forEach((panel, panelIndex) => {
    panel.hidden = panelIndex !== index;
  });
}

function navigateAreaTabs(event, index, count) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  let next = index;
  if (event.key === "ArrowLeft") next = (index - 1 + count) % count;
  if (event.key === "ArrowRight") next = (index + 1) % count;
  if (event.key === "Home") next = 0;
  if (event.key === "End") next = count - 1;
  activateArea(next);
  elements.orderAreas.querySelectorAll("[role=tab]")[next]?.focus();
}

function areaTabLabel(area, index) {
  const label = String(area?.label || "").trim();
  if (!label || /^[—–-]+$/.test(label) || /^area\s+\d+$/i.test(label)) return `Tab ${index + 1}`;
  return label;
}

function renderAreaTable(area) {
  const shell = document.createElement("div");
  shell.className = "order-lines-shell";
  const table = document.createElement("table");
  table.className = "order-lines-table";
  table.innerHTML = "<thead><tr><th>Product</th><th>SKU</th><th class=\"line-quantity\">Quantity</th></tr></thead>";
  const body = document.createElement("tbody");
  const groups = groupAreaLines(area);

  groups.forEach((lines, sectionName) => {
    const sectionRow = document.createElement("tr");
    sectionRow.className = "order-line-section-row";
    const heading = document.createElement("th");
    heading.colSpan = 3;
    heading.scope = "colgroup";
    heading.textContent = sectionName;
    sectionRow.append(heading);
    body.append(sectionRow);

    lines.forEach((line) => {
      const row = document.createElement("tr");
      const productCell = document.createElement("td");
      productCell.append(text("strong", "line-product-name", line.label || "Product"));
      row.append(
        productCell,
        text("td", "line-sku", line.sku || "—"),
        text("td", "line-quantity", String(line.quantity)),
      );
      body.append(row);
    });
  });

  table.append(body);
  shell.append(table);
  return shell;
}

function groupAreaLines(area) {
  const groups = new Map();
  (area.items || []).forEach((item) => addGroupLine(groups, item.section || "Products", {
    label: item.label || item.key,
    sku: item.sku || "",
    quantity: Number(item.quantity || 0),
  }));
  (area.otherMaterials || []).forEach((item) => addGroupLine(groups, "Additional products", {
    label: item.description || item.sku,
    sku: item.sku || "",
    quantity: Number(item.quantity || 0),
  }));
  return groups;
}

function addGroupLine(groups, section, line) {
  if (!groups.has(section)) groups.set(section, []);
  groups.get(section).push(line);
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

function displayCompanyName(value) {
  return String(value || "").trim().toLocaleUpperCase("en-AU");
}

function displayActorName(value) {
  const raw = String(value || "Legacy order").trim();
  const display = displayUsername(raw);
  const compact = raw.replace(/[^A-Za-z0-9]/g, "");
  return compact.length > 0 && compact.length <= 3 ? display.toLocaleUpperCase("en-AU") : display;
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
