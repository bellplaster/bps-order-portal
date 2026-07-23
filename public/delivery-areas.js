(() => {
  const DEFAULT_AREAS = [
    { id: "ground", label: "Ground Floor" },
    { id: "first", label: "1st Floor" },
  ];
  const MAX_AREAS = 20;

  prepareAreaWorkspace();
  initialiseAreaState();

  const originalBindStaticActions = bindStaticActions;
  bindStaticActions = function bindStaticActionsWithAreas(...args) {
    const result = originalBindStaticActions.apply(this, args);
    bindAreaActions();
    return result;
  };

  loadCatalog = async function loadCatalogWithAreas() {
    const result = await fetchJson("/api/catalog");
    state.catalog = result.products || {};
    state.layout = result.layout;
    if (!state.layout) throw new Error("The product order form layout is missing.");
    const renderer = window.renderUnifiedFloorSheet;
    if (typeof renderer !== "function") throw new Error("The unified board renderer did not load.");
    renderAreaWorkspace();
  };

  activateFloor = function activateDeliveryArea(areaId) {
    if (!state.deliveryAreas.some((area) => area.id === areaId)) return;
    state.activeFloor = areaId;
    document.querySelectorAll("[data-floor-tab]").forEach((button) => {
      const active = button.dataset.floorTab === areaId;
      button.closest(".area-tab-shell")?.classList.toggle("is-active", active);
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    document.querySelectorAll("[data-floor-panel]").forEach((panel) => {
      const active = panel.dataset.floorPanel === areaId;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
    scheduleDraft();
  };

  buildPayload = function buildPayloadWithAreas() {
    parseAndStoreManualAddress();
    const floors = {};
    state.deliveryAreas.forEach((area) => {
      floors[area.id] = {
        label: area.label,
        ...buildFloorPayload(area.id),
      };
    });
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
      activeArea: state.activeFloor,
      floors,
    };
  };

  selectedProductLines = function selectedAreaProductLines() {
    return state.deliveryAreas.flatMap((area) => getFloorLines(area.id));
  };

  renderReview = function renderReviewWithAreas() {
    const payload = buildPayload();
    const details = [
      ["Customer", state.account?.companyName],
      ["Debtor code", state.account?.debtorCode],
      ["Order number", payload.reference],
      ["Required", `${formatDate(payload.requiredDate)} · ${timeSlotLabel(payload.timeSlot)}`],
      ["Contact", `${payload.contact} · ${payload.mobile}`],
      ["Delivery address", payload.deliveryAddress],
      ["Delivery instructions", combinedDeliveryNotes(payload)],
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
    state.deliveryAreas.forEach((area) => {
      const lines = getFloorLines(area.id);
      if (!lines.length) return;
      const group = document.createElement("section");
      group.className = "review-floor-group";
      const heading = document.createElement("h3");
      heading.textContent = area.label;
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
    });
    document.getElementById("reviewLineTotal").textContent = `${lineCount} product line${lineCount === 1 ? "" : "s"}`;
    document.getElementById("reviewUnitTotal").textContent = `${unitCount} total unit${unitCount === 1 ? "" : "s"}`;
  };

  applyPayload = function applyPayloadWithAreas(payload) {
    state.suppressDraft = true;
    setValue("reference", payload.reference || payload.customerReference || "");
    setValue("contactName", payload.contact || payload.siteContact || state.account?.defaultContactName || "");
    setValue("contactMobile", payload.mobile || payload.siteContactPhone || state.account?.defaultMobile || "");
    setValue("requiredDate", payload.requiredDate || "");
    setValue("deliveryAddressSearch", formatAddressDisplay(payload.deliveryAddress || ""));
    setValue("deliveryAddress", payload.deliveryAddress || "");
    setValue("deliveryAddressLine1", payload.addressLine1 || payload.siteAddress1 || "");
    setValue("deliveryAddressLine2", payload.addressLine2 || payload.siteAddress2 || "");
    setValue("deliveryInstructions", payload.deliveryInstructions || payload.comments || "");
    setRadio("timeSlot", payload.timeSlot || "ANY");
    setRadio("deliveryType", deliveryTypes.has(payload.deliveryType) ? payload.deliveryType : "");
    document.querySelectorAll('input[name="deliveryExtra"]').forEach((input) => {
      input.checked = (payload.extras || []).includes(input.value);
    });

    const entries = Object.entries(payload.floors || {});
    state.deliveryAreas = entries.length
      ? entries.slice(0, MAX_AREAS).map(([id, area], index) => ({
          id: normaliseAreaId(id, index),
          label: cleanAreaLabel(area?.label || legacyAreaLabel(id, index)),
        }))
      : DEFAULT_AREAS.map((area) => ({ ...area }));
    state.quantities = {};
    state.otherMaterials = {};
    state.deliveryAreas.forEach((area) => {
      floorLabels[area.id] = area.label;
      state.quantities[area.id] = new Map();
      state.otherMaterials[area.id] = [];
      const source = payload.floors?.[area.id] || payload.floors?.[entries.find(([key]) => normaliseAreaId(key) === area.id)?.[0]] || {};
      (source.items || []).forEach((item) => state.quantities[area.id].set(item.key, Number(item.quantity || 0)));
      state.otherMaterials[area.id] = (source.otherMaterials || []).map((item) => ({
        sku: item.sku,
        description: item.description || item.sku,
        quantity: Number(item.quantity || 1),
      }));
    });
    state.activeFloor = state.deliveryAreas.some((area) => area.id === payload.activeArea)
      ? payload.activeArea
      : state.deliveryAreas[0].id;

    if (state.layout) renderAreaWorkspace();
    updateFutureDateConfirmation();
    updatePickupMode();
    updateGeneratedDeliverySummary();
    renderCounts();
    state.suppressDraft = false;
  };

  resetOrder = function resetOrderWithAreas() {
    state.editingOrder = null;
    state.deliveryAreas = DEFAULT_AREAS.map((area) => ({ ...area }));
    state.activeFloor = "ground";
    state.quantities = {};
    state.otherMaterials = {};
    state.deliveryAreas.forEach((area) => {
      floorLabels[area.id] = area.label;
      state.quantities[area.id] = new Map();
      state.otherMaterials[area.id] = [];
    });
    document.getElementById("orderForm").reset();
    setToday();
    setValue("customerName", state.account?.companyName || "");
    setValue("contactName", state.account?.defaultContactName || "");
    setValue("contactMobile", state.account?.defaultMobile || "");
    setRadio("timeSlot", "ANY");
    clearAddress();
    document.getElementById("editModeBanner").hidden = true;
    document.getElementById("submitButton").textContent = "Submit order";
    if (state.layout) renderAreaWorkspace();
    updateGeneratedDeliverySummary();
    renderCounts();
    clearDraft();
    document.getElementById("successScreen").hidden = true;
    setStep("form");
  };

  function prepareAreaWorkspace() {
    const area = document.querySelector(".products-area");
    const tabs = area?.querySelector(".floor-tabs");
    if (!area || !tabs) return;
    tabs.id = "deliveryAreaTabs";
    tabs.replaceChildren();
    area.querySelectorAll(":scope > .floor-panel").forEach((panel) => panel.remove());
    let panels = area.querySelector(".floor-panels");
    if (!panels) {
      panels = document.createElement("div");
      panels.className = "floor-panels";
      tabs.after(panels);
    }
  }

  function initialiseAreaState() {
    if (!Array.isArray(state.deliveryAreas) || !state.deliveryAreas.length) {
      state.deliveryAreas = DEFAULT_AREAS.map((area) => ({ ...area }));
    }
    state.deliveryAreas.forEach((area) => {
      floorLabels[area.id] = area.label;
      if (!(state.quantities[area.id] instanceof Map)) state.quantities[area.id] = new Map();
      if (!Array.isArray(state.otherMaterials[area.id])) state.otherMaterials[area.id] = [];
    });
    if (!state.deliveryAreas.some((area) => area.id === state.activeFloor)) state.activeFloor = state.deliveryAreas[0].id;
  }

  function renderAreaWorkspace() {
    prepareAreaWorkspace();
    initialiseAreaState();
    const tabs = document.getElementById("deliveryAreaTabs");
    const panels = document.querySelector(".products-area > .floor-panels");
    if (!tabs || !panels) return;
    tabs.replaceChildren();
    panels.replaceChildren();

    state.deliveryAreas.forEach((area) => {
      floorLabels[area.id] = area.label;
      const shell = document.createElement("div");
      shell.className = "area-tab-shell";
      shell.dataset.areaId = area.id;

      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "floor-tab";
      tab.dataset.floorTab = area.id;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", "false");
      tab.title = "Double-click to rename";
      tab.textContent = area.label;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "area-tab-delete";
      remove.dataset.deleteArea = area.id;
      remove.setAttribute("aria-label", `Delete ${area.label}`);
      remove.textContent = "×";
      remove.hidden = state.deliveryAreas.length === 1;
      shell.append(tab, remove);
      tabs.append(shell);

      const panel = document.createElement("article");
      panel.className = "floor-panel";
      panel.dataset.floorPanel = area.id;
      panel.setAttribute("role", "tabpanel");
      panel.hidden = true;
      const sheet = document.createElement("div");
      sheet.id = `${area.id}OrderSheet`;
      sheet.className = "pdf-form-sheet";
      panel.append(sheet);
      panels.append(panel);
      window.renderUnifiedFloorSheet(area.id);
    });

    const add = document.createElement("button");
    add.type = "button";
    add.className = "area-tab-add";
    add.dataset.addArea = "true";
    add.textContent = "+ Add area";
    add.disabled = state.deliveryAreas.length >= MAX_AREAS;
    tabs.append(add);
    activateFloor(state.activeFloor);
  }

  function bindAreaActions() {
    const tabs = document.getElementById("deliveryAreaTabs");
    if (!tabs || tabs.dataset.bound === "true") return;
    tabs.dataset.bound = "true";
    tabs.addEventListener("click", (event) => {
      const deleteButton = event.target.closest("[data-delete-area]");
      if (deleteButton) {
        deleteArea(deleteButton.dataset.deleteArea);
        return;
      }
      if (event.target.closest("[data-add-area]")) {
        openAreaEditor();
        return;
      }
      const tab = event.target.closest("[data-floor-tab]");
      if (tab) activateFloor(tab.dataset.floorTab);
    });
    tabs.addEventListener("dblclick", (event) => {
      const tab = event.target.closest("[data-floor-tab]");
      if (tab) openAreaEditor(tab.dataset.floorTab);
    });
  }

  function openAreaEditor(areaId = "") {
    const tabs = document.getElementById("deliveryAreaTabs");
    if (!tabs) return;
    tabs.querySelector(".area-name-editor")?.remove();
    const existing = state.deliveryAreas.find((area) => area.id === areaId);
    const editor = document.createElement("form");
    editor.className = "area-name-editor";
    editor.innerHTML = `<input type="text" maxlength="40" autocomplete="off" aria-label="Delivery area name" placeholder="e.g. Unit 1 or Garage"><button type="submit">${existing ? "Rename" : "Add"}</button><button type="button" data-cancel-area>Cancel</button>`;
    const input = editor.querySelector("input");
    input.value = existing?.label || "";
    editor.addEventListener("submit", (event) => {
      event.preventDefault();
      const label = cleanAreaLabel(input.value);
      if (!label) return input.focus();
      if (state.deliveryAreas.some((area) => area.id !== areaId && area.label.toLowerCase() === label.toLowerCase())) {
        input.setCustomValidity("Use a different area name.");
        input.reportValidity();
        return;
      }
      if (existing) {
        existing.label = label;
        floorLabels[existing.id] = label;
      } else {
        const id = makeAreaId(label);
        state.deliveryAreas.push({ id, label });
        state.quantities[id] = new Map();
        state.otherMaterials[id] = [];
        floorLabels[id] = label;
        state.activeFloor = id;
      }
      renderAreaWorkspace();
      scheduleDraft();
    });
    editor.querySelector("[data-cancel-area]").addEventListener("click", () => editor.remove());
    tabs.append(editor);
    input.focus();
    input.select();
  }

  function deleteArea(areaId) {
    if (state.deliveryAreas.length === 1) return;
    const index = state.deliveryAreas.findIndex((area) => area.id === areaId);
    if (index < 0) return;
    const area = state.deliveryAreas[index];
    const hasProducts = getFloorLines(areaId).length > 0;
    if (hasProducts && !window.confirm(`Delete ${area.label} and all quantities entered in this tab?`)) return;
    state.deliveryAreas.splice(index, 1);
    delete state.quantities[areaId];
    delete state.otherMaterials[areaId];
    delete floorLabels[areaId];
    if (state.activeFloor === areaId) {
      state.activeFloor = state.deliveryAreas[Math.min(index, state.deliveryAreas.length - 1)].id;
    }
    renderAreaWorkspace();
    scheduleDraft();
  }

  function makeAreaId(label) {
    const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 28) || "area";
    let id = `area-${base}`;
    let suffix = 2;
    while (state.deliveryAreas.some((area) => area.id === id)) id = `area-${base}-${suffix++}`;
    return id;
  }

  function normaliseAreaId(value, index = 0) {
    const text = String(value || "").trim();
    if (/^[a-z0-9][a-z0-9-]{0,59}$/i.test(text)) return text;
    return `area-${index + 1}`;
  }

  function cleanAreaLabel(value) {
    return String(value || "").trim().replace(/\s+/g, " ").slice(0, 40);
  }

  function legacyAreaLabel(id, index) {
    if (id === "ground") return "Ground Floor";
    if (id === "first") return "1st Floor";
    return `Area ${index + 1}`;
  }
})();