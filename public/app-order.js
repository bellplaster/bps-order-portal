function setStep(step, options = {}) {
  state.activeStep = step;
  document.querySelectorAll("[data-step]").forEach((panel) => {
    const active = panel.dataset.step === step;
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  });
  document.querySelectorAll("[data-step-target]").forEach((button) => button.classList.toggle("is-active", button.dataset.stepTarget === step));
  document.getElementById("successScreen").hidden = true;
  if (options.scrollTop !== false) window.scrollTo({ top: 0, behavior: "smooth" });
}

function validateForm() {
  clearMessages();
  const reference = value("reference");
  if (!reference) throw fieldError("reference", "Enter the customer order reference.");
  const requiredDate = value("requiredDate");
  if (!requiredDate) throw fieldError("requiredDate", "Choose the required date.");
  const today = value("orderDateIso");
  if (requiredDate < today) throw fieldError("requiredDate", "Required date cannot be earlier than today.");
  if (daysBetween(today, requiredDate) > 365) throw fieldError("requiredDate", "Required date cannot be more than 12 months away.");
  if (daysBetween(today, requiredDate) >= 180 && !document.getElementById("confirmFutureRequiredDate").checked) {
    throw new Error("Confirm the required date because it is at least six months away.");
  }
  const contact = value("contactName");
  if (!contact || !/^[\p{L}\p{M}'’.\-\s]+$/u.test(contact)) throw fieldError("contactName", "Enter a valid contact name without numbers.");
  const mobile = normaliseMobile(value("contactMobile"));
  if (!mobile) throw fieldError("contactMobile", "Enter an Australian mobile number beginning with 04.");
  const deliveryType = selectedRadio("deliveryType");
  if (!deliveryTypes.has(deliveryType)) throw new Error("Choose a delivery type.");
  const pickup = deliveryType === "Pickup (Customer to collect)";
  if (!pickup) {
    parseAndStoreManualAddress();
    const line1 = value("deliveryAddressLine1");
    const line2 = value("deliveryAddressLine2");
    if (!line1 || !line2 || !/\bVIC\b/i.test(line2) || !/\b(?:3\d{3}|8\d{3})\b/.test(line2)) {
      throw fieldError("deliveryAddressSearch", "Enter a complete Victorian street, suburb and postcode.");
    }
  }
  if (!selectedProductLines().length) throw new Error("Enter a quantity for at least one product.");
  return true;
}

function buildPayload() {
  parseAndStoreManualAddress();
  return {
    submissionId: state.editingOrder?.submissionId || crypto.randomUUID(),
    orderDate: value("orderDateIso"),
    reference: value("reference"),
    customer: state.account?.companyName || "",
    contact: value("contactName"),
    mobile: normaliseMobile(value("contactMobile")) || value("contactMobile"),
    requiredDate: value("requiredDate"),
    futureDateConfirmed: document.getElementById("confirmFutureRequiredDate").checked,
    timeSlot: selectedRadio("timeSlot") || "ANY",
    deliveryType: selectedRadio("deliveryType"),
    extras: checkedValues("deliveryExtra"),
    deliveryAddress: value("deliveryAddress") || value("deliveryAddressSearch"),
    addressLine1: value("deliveryAddressLine1"),
    addressLine2: value("deliveryAddressLine2"),
    deliveryInstructions: value("deliveryInstructions"),
    floors: {
      ground: buildFloorPayload("ground"),
      first: buildFloorPayload("first"),
    },
  };
}

function buildFloorPayload(floor) {
  return {
    items: [...state.quantities[floor].entries()].filter(([, quantity]) => quantity > 0).map(([key, quantity]) => ({ key, quantity })),
    otherMaterials: state.otherMaterials[floor].filter((item) => item.quantity > 0).map((item) => ({ sku: item.sku, quantity: item.quantity })),
  };
}

function renderReview() {
  const payload = buildPayload();
  const details = [
    ["Customer", state.account?.companyName],
    ["Debtor code", state.account?.debtorCode],
    ["Reference", payload.reference],
    ["Required", `${formatDate(payload.requiredDate)} · ${payload.timeSlot}`],
    ["Contact", `${payload.contact} · ${payload.mobile}`],
    ["Delivery address", payload.deliveryAddress],
    ["Delivery type", payload.deliveryType],
    ["Extras", payload.extras.join(", ") || "None"],
    ["Instructions", payload.deliveryInstructions || "None"],
  ];
  const detailsRoot = document.getElementById("reviewDetails");
  detailsRoot.replaceChildren();
  details.forEach(([label, content]) => {
    const item = document.createElement("div");
    item.innerHTML = `<span>${escapeHtml(label)}</span><strong>${escapeHtml(content || "—")}</strong>`;
    detailsRoot.append(item);
  });

  const linesRoot = document.getElementById("reviewOrderLines");
  linesRoot.replaceChildren();
  let lineCount = 0;
  let unitCount = 0;
  for (const floor of ["ground", "first"]) {
    const lines = getFloorLines(floor);
    if (!lines.length) continue;
    const group = document.createElement("section");
    group.className = "review-floor-group";
    const heading = document.createElement("h3");
    heading.textContent = floorLabels[floor];
    group.append(heading);
    lines.forEach((line) => {
      const row = document.createElement("div");
      row.className = "review-line";
      row.innerHTML = `<div><strong>${escapeHtml(line.label)}</strong><span>${escapeHtml(line.sku || "")}</span></div><b>${line.quantity}</b>`;
      group.append(row);
      lineCount += 1;
      unitCount += line.quantity;
    });
    linesRoot.append(group);
  }
  document.getElementById("reviewLineTotal").textContent = `${lineCount} product line${lineCount === 1 ? "" : "s"}`;
  document.getElementById("reviewUnitTotal").textContent = `${unitCount} total unit${unitCount === 1 ? "" : "s"}`;
}

async function submitOrder(event) {
  event.preventDefault();
  const button = document.getElementById("submitButton");
  try {
    validateForm();
    button.disabled = true;
    button.textContent = state.editingOrder ? "Updating order…" : "Submitting order…";
    const payload = buildPayload();
    const url = state.editingOrder ? `/api/orders/${encodeURIComponent(state.editingOrder.submissionId)}` : "/api/submit";
    const method = state.editingOrder ? "PUT" : "POST";
    const result = await fetchJson(url, { method, body: JSON.stringify(payload) });
    showSuccess(result);
    clearDraft();
    await loadOrderHistory();
  } catch (error) {
    showFormMessage(error.message || String(error), "error");
  } finally {
    button.disabled = false;
    button.textContent = state.editingOrder ? "Update order" : "Submit order";
  }
}

function showSuccess(result) {
  document.querySelectorAll("[data-step]").forEach((panel) => { panel.hidden = true; panel.classList.remove("is-active"); });
  const screen = document.getElementById("successScreen");
  screen.hidden = false;
  document.getElementById("successTitle").textContent = result.updated ? "Order updated" : "Order created";
  document.getElementById("successSummary").textContent = `${result.companyName || state.account?.companyName || "Customer"} order has been saved and the Accrivia files are ready.`;
  document.getElementById("orderNumberDisplay").textContent = result.customerReference || result.submissionId;
  const files = document.getElementById("generatedFiles");
  files.replaceChildren();
  (result.generatedFiles || []).forEach((file) => {
    const row = document.createElement("a");
    row.className = "success-file";
    row.href = file.downloadUrl;
    row.innerHTML = `<div><strong>${escapeHtml(file.floorLabel)}</strong><span>${escapeHtml(file.filename)}</span></div><b>Download XLSX</b>`;
    files.append(row);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function loadOrderHistory() {
  const list = document.getElementById("historyList");
  list.innerHTML = '<p class="empty-state">Loading orders…</p>';
  try {
    const result = await fetchJson("/api/orders");
    const showArchived = document.getElementById("showArchivedOrders").checked;
    const orders = (result.orders || []).filter((order) => showArchived || order.status !== "archived");
    list.replaceChildren();
    if (!orders.length) {
      list.innerHTML = '<p class="empty-state">No orders found.</p>';
      return;
    }
    orders.forEach((order) => list.append(renderHistoryOrder(order)));
  } catch (error) {
    list.innerHTML = `<p class="empty-state">${escapeHtml(error.message || String(error))}</p>`;
  }
}

function renderHistoryOrder(order) {
  const card = document.createElement("article");
  card.className = "history-card";
  const details = order.order_details || {};
  const top = document.createElement("div");
  top.className = "history-card-top";
  top.innerHTML = `<div><span>${escapeHtml(order.company_name || details.customer || "Customer")}</span><h3>${escapeHtml(order.customer_reference)}</h3></div><em class="status-${escapeHtml(order.status)}">${escapeHtml(order.status)}</em>`;
  const meta = document.createElement("dl");
  meta.innerHTML = `
    <div><dt>Required</dt><dd>${escapeHtml([formatDate(details.required_date), details.time_slot].filter(Boolean).join(" · ") || "—")}</dd></div>
    <div><dt>Delivery</dt><dd>${escapeHtml(details.delivery_type || "—")}</dd></div>
    <div><dt>Address</dt><dd>${escapeHtml(details.delivery_address || "—")}</dd></div>
  `;
  const files = document.createElement("div");
  files.className = "history-files";
  const latestByFloor = new Map();
  (order.files || []).forEach((file) => {
    if (!latestByFloor.has(file.floor)) latestByFloor.set(file.floor, file);
  });
  latestByFloor.forEach((file) => {
    const link = document.createElement("a");
    link.href = file.download_url;
    link.textContent = `Download ${file.floor_label} XLSX`;
    files.append(link);
  });
  const actions = document.createElement("div");
  actions.className = "history-actions";
  if (order.can_edit) actions.append(actionButton("Edit", () => editOrder(order.submission_id)));
  if (order.can_archive) actions.append(actionButton("Archive", () => updateOrderStatus(order.submission_id, "archive")));
  if (order.can_restore) actions.append(actionButton("Restore", () => updateOrderStatus(order.submission_id, "restore")));
  actions.append(actionButton("Delete", () => deleteOrder(order.submission_id, order.customer_reference), "danger"));
  card.append(top, meta, files, actions);
  return card;
}

function actionButton(label, handler, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `text-button ${className}`.trim();
  button.textContent = label;
  button.addEventListener("click", handler);
  return button;
}

async function editOrder(submissionId) {
  try {
    const result = await fetchJson(`/api/orders/${encodeURIComponent(submissionId)}`);
    const payload = result.payload || {};
    state.editingOrder = {
      submissionId,
      orderNumber: result.order?.orderNumber,
      latestRevision: result.order?.latestRevision || 1,
    };
    applyPayload(payload);
    document.getElementById("editModeBanner").hidden = false;
    document.getElementById("editOrderNumber").textContent = result.order?.orderNumber || "";
    document.getElementById("editRevisionText").textContent = `Revision ${Number(result.order?.latestRevision || 1) + 1}`;
    document.getElementById("submitButton").textContent = "Update order";
    closeHistory();
    setStep("form");
  } catch (error) {
    showGlobal(error.message || String(error), "error");
  }
}

async function updateOrderStatus(submissionId, action) {
  try {
    await fetchJson(`/api/orders/${encodeURIComponent(submissionId)}`, { method: "PATCH", body: JSON.stringify({ action }) });
    await loadOrderHistory();
  } catch (error) {
    showGlobal(error.message || String(error), "error");
  }
}

async function deleteOrder(submissionId, reference) {
  const confirmation = window.prompt(`Type ${reference} to permanently delete this order.`);
  if (confirmation !== reference) return;
  try {
    await fetchJson(`/api/orders/${encodeURIComponent(submissionId)}`, { method: "DELETE" });
    await loadOrderHistory();
  } catch (error) {
    showGlobal(error.message || String(error), "error");
  }
}

function applyPayload(payload) {
  state.suppressDraft = true;
  setValue("reference", payload.reference || payload.customerReference || "");
  setValue("contactName", payload.contact || payload.siteContact || state.account?.defaultContactName || "");
  setValue("contactMobile", payload.mobile || payload.siteContactPhone || state.account?.defaultMobile || "");
  setValue("requiredDate", payload.requiredDate || "");
  setValue("deliveryAddressSearch", payload.deliveryAddress || "");
  setValue("deliveryAddress", payload.deliveryAddress || "");
  setValue("deliveryAddressLine1", payload.addressLine1 || payload.siteAddress1 || "");
  setValue("deliveryAddressLine2", payload.addressLine2 || payload.siteAddress2 || "");
  setValue("deliveryInstructions", payload.deliveryInstructions || payload.comments || "");
  setRadio("timeSlot", payload.timeSlot || "ANY");
  setRadio("deliveryType", payload.deliveryType || "");
  document.querySelectorAll('input[name="deliveryExtra"]').forEach((input) => { input.checked = (payload.extras || []).includes(input.value); });
  state.quantities = { ground: new Map(), first: new Map() };
  state.otherMaterials = { ground: [], first: [] };
  ["ground", "first"].forEach((floor) => {
    (payload.floors?.[floor]?.items || []).forEach((item) => state.quantities[floor].set(item.key, Number(item.quantity || 0)));
    state.otherMaterials[floor] = (payload.floors?.[floor]?.otherMaterials || []).map((item) => ({
      sku: item.sku,
      description: item.description || item.sku,
      quantity: Number(item.quantity || 1),
    }));
    syncQuantityInputs(floor);
    renderSelectedAdditional(floor);
  });
  updateFutureDateConfirmation();
  updatePickupMode();
  renderCounts();
  state.suppressDraft = false;
}

function resetOrder() {
  state.editingOrder = null;
  state.quantities = { ground: new Map(), first: new Map() };
  state.otherMaterials = { ground: [], first: [] };
  document.getElementById("orderForm").reset();
  setToday();
  setValue("customerName", state.account?.companyName || "");
  setValue("contactName", state.account?.defaultContactName || "");
  setValue("contactMobile", state.account?.defaultMobile || "");
  setRadio("timeSlot", "ANY");
  clearAddress();
  document.getElementById("editModeBanner").hidden = true;
  document.getElementById("submitButton").textContent = "Submit order";
  document.querySelectorAll(".quantity-input").forEach((input) => { input.value = ""; });
  renderSelectedAdditional("ground");
  renderSelectedAdditional("first");
  renderCounts();
  clearDraft();
  document.getElementById("successScreen").hidden = true;
  setStep("form");
}

function renderCounts() {
  ["ground", "first"].forEach((floor) => {
    const count = state.quantities[floor].size + state.otherMaterials[floor].length;
    const badge = document.getElementById(`${floor}TabCount`);
    badge.textContent = count;
    badge.hidden = count === 0;
  });
}

function selectedProductLines() {
  return ["ground", "first"].flatMap((floor) => getFloorLines(floor));
}

function getFloorLines(floor) {
  const mapped = [...state.quantities[floor].entries()].map(([key, quantity]) => ({
    floor,
    key,
    sku: state.catalog[key]?.sku || "Pending mapping",
    label: state.catalog[key]?.label || key,
    quantity,
  }));
  const additional = state.otherMaterials[floor].map((item) => ({ floor, sku: item.sku, label: item.description, quantity: item.quantity }));
  return [...mapped, ...additional].filter((line) => line.quantity > 0);
}
