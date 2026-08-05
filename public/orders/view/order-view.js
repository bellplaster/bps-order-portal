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
    "orderLowerGrid",
    "orderFilesCard",
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
  const viewerRole = String(result.viewer?.role || "").toLowerCase();
  const internalViewer = viewerRole === "admin" || viewerRole === "customer_service";

  document.title = `${order.customerReference || "Order"} | Bell Plaster Order Portal`;
  elements.orderReference.textContent = `Order ${order.customerReference || ""}`.trim();
  elements.orderStatus.className = `order-status status-${safeToken(order.status)}`;
  elements.orderStatus.textContent = statusLabel(order.status);
  elements.orderSubmittedMeta.textContent = `Submitted ${formatDateTime(order.createdAt)} by ${displayActorName(order.createdByUsername || order.createdByName)}`;

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
    ["Placed under", [displayCompanyName(order.companyName), String(order.debtorCode || "").toUpperCase()].filter(Boolean).join(" · ") || "—"],
  ]);

  const areaCount = Number(snapshot.totals?.areaCount || 0);
  elements.orderProductSummary.textContent = `${Number(snapshot.totals?.lineCount || 0)} product lines across ${areaCount} tab${areaCount === 1 ? "" : "s"}.`;
  state.activeAreaIndex = 0;
  renderAreas(snapshot.areas || []);

  elements.orderFilesCard.hidden = !internalViewer;
  elements.orderLowerGrid.classList.toggle("is-single", !internalViewer);
  if (internalViewer) renderFiles(result.files || []);
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
    panel.append(renderAreaTable(area));
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
  return table;
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
