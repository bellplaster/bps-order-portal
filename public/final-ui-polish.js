(() => {
  const TILE_PATTERN = /KNAUF\s+CEILING\s+TILES|SHEETROCK\s+Nova\s+Ceiling\s+Tiles/i;
  let timeSlotTouched = false;
  let attempts = 0;
  let defaultAreaNormalised = false;

  normaliseFreshDefaultArea();
  simplifyStepNavigation();
  patchBoardRenderer();
  patchTimeSlotValidation();
  patchUnifiedDeliverySync();
  patchAreaCounts();
  removeCeilingTileProduct();
  polishDeliveryControls();
  polishDeliveryAreaTabs();

  document.addEventListener("input", (event) => {
    if (event.target.matches(".quantity-input")) updateAreaCounts();
  });

  document.addEventListener("submit", (event) => {
    if (event.target.matches(".area-name-editor")) window.setTimeout(polishDeliveryAreaTabs, 0);
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-delete-area]")) window.setTimeout(polishDeliveryAreaTabs, 0);
  });

  const retryTimer = window.setInterval(() => {
    attempts += 1;
    normaliseFreshDefaultArea();
    patchBoardRenderer();
    patchTimeSlotValidation();
    patchUnifiedDeliverySync();
    patchAreaCounts();
    removeCeilingTileProduct();
    polishDeliveryControls();
    polishDeliveryAreaTabs();

    const controlsReady = Boolean(
      document.querySelector(".delivery-select-timeSlot .delivery-select")
      && document.querySelector(".delivery-select-deliveryType .delivery-select")
      && document.querySelector(".extras-dropdown > summary")
    );
    const layoutReady = typeof state !== "undefined" && Boolean(state.layout);
    const tabsReady = Boolean(document.querySelector(".area-tab-shell"));
    if ((controlsReady && layoutReady && tabsReady) || attempts >= 50) window.clearInterval(retryTimer);
  }, 100);

  document.getElementById("orderForm")?.addEventListener("reset", () => {
    timeSlotTouched = false;
    window.setTimeout(() => {
      clearTimeSlotSelection();
      polishDeliveryControls();
      polishDeliveryAreaTabs();
    }, 0);
  });

  function normaliseFreshDefaultArea() {
    if (defaultAreaNormalised || typeof state === "undefined") return;
    if (document.querySelector(".area-tab-shell")) return;
    const areas = state.deliveryAreas;
    if (!Array.isArray(areas) || !areas.length) return;
    const legacyDefault = areas.every((area) => ["ground", "first"].includes(area.id));
    if (!legacyDefault || hasMeaningfulDraftData()) {
      defaultAreaNormalised = true;
      return;
    }

    const hasStoredLines = Object.values(state.quantities || {}).some((quantities) =>
      quantities instanceof Map && [...quantities.values()].some((quantity) => Number(quantity) > 0)
    ) || Object.values(state.otherMaterials || {}).some((items) =>
      Array.isArray(items) && items.some((item) => Number(item.quantity) > 0)
    );
    if (hasStoredLines) {
      defaultAreaNormalised = true;
      return;
    }

    state.deliveryAreas = [{ id: "area-1", label: "Area 1" }];
    state.activeFloor = "area-1";
    state.quantities = { "area-1": new Map() };
    state.otherMaterials = { "area-1": [] };
    if (typeof floorLabels !== "undefined") {
      Object.keys(floorLabels).forEach((key) => delete floorLabels[key]);
      floorLabels["area-1"] = "Area 1";
    }
    defaultAreaNormalised = true;
  }

  function simplifyStepNavigation() {
    const orderStep = document.querySelector('[data-step-target="form"] .step-copy');
    const reviewStep = document.querySelector('[data-step-target="review"] .step-copy');
    if (orderStep) orderStep.replaceChildren(makeStrong("Order"));
    if (reviewStep) reviewStep.replaceChildren(makeStrong("Review"));
  }

  function makeStrong(text) {
    const strong = document.createElement("strong");
    strong.textContent = text;
    return strong;
  }

  function patchUnifiedDeliverySync() {
    const originalSync = window.syncUnifiedDeliveryControls;
    if (typeof originalSync !== "function" || originalSync.__finalPolishPatched) return;
    const patched = function syncUnifiedDeliveryControlsWithPolish(...args) {
      const result = originalSync.apply(this, args);
      polishDeliveryControls();
      return result;
    };
    patched.__finalPolishPatched = true;
    window.syncUnifiedDeliveryControls = patched;
  }

  function polishDeliveryControls() {
    const timeSelect = document.querySelector(".delivery-select-timeSlot .delivery-select");
    const deliverySelect = document.querySelector(".delivery-select-deliveryType .delivery-select");
    if (!timeSelect || !deliverySelect) return;

    let placeholder = timeSelect.querySelector('option[value=""]');
    if (!placeholder) {
      placeholder = new Option("Select time slot", "");
      timeSelect.insertBefore(placeholder, timeSelect.firstChild);
    }
    placeholder.textContent = "Select time slot";
    placeholder.disabled = false;
    placeholder.hidden = false;
    timeSelect.required = true;

    if (!timeSelect.dataset.polished) {
      timeSelect.dataset.polished = "true";
      timeSelect.addEventListener("change", () => {
        timeSlotTouched = Boolean(timeSelect.value);
        if (!timeSelect.value) {
          document.querySelectorAll('input[name="timeSlot"]').forEach((radio) => { radio.checked = false; });
        }
        updatePlaceholderState(timeSelect);
      });
    }

    if (!deliverySelect.dataset.polished) {
      deliverySelect.dataset.polished = "true";
      deliverySelect.addEventListener("change", () => updatePlaceholderState(deliverySelect));
    }

    const selectedTime = document.querySelector('input[name="timeSlot"]:checked');
    const freshOrder = !hasMeaningfulDraftData();
    if (!timeSlotTouched && freshOrder && selectedTime?.value === "ANY") clearTimeSlotSelection();
    else if (!selectedTime) timeSelect.value = "";

    updatePlaceholderState(timeSelect);
    updatePlaceholderState(deliverySelect);
    polishExtrasDropdown();
  }

  function polishExtrasDropdown() {
    const details = document.querySelector(".extras-dropdown");
    const summary = details?.querySelector(":scope > summary");
    const summaryText = summary?.querySelector("span");
    const inputs = details ? [...details.querySelectorAll('input[name="deliveryExtra"]')] : [];
    if (!details || !summary || !summaryText || !inputs.length) return;

    const update = () => {
      const values = inputs
        .filter((input) => input.checked)
        .map((input) => input.closest("label")?.querySelector("span")?.textContent?.trim() || input.value);
      const isEmpty = values.length === 0;
      summaryText.textContent = isEmpty ? "Select extras" : values.join(", ");
      summary.title = summaryText.textContent;
      summary.classList.toggle("is-placeholder", isEmpty);
    };

    if (!details.dataset.standardised) {
      details.dataset.standardised = "true";
      inputs.forEach((input) => input.addEventListener("change", update));
    }
    update();
  }

  function updatePlaceholderState(select) {
    select?.classList.toggle("is-placeholder", !select.value);
  }

  function clearTimeSlotSelection() {
    document.querySelectorAll('input[name="timeSlot"]').forEach((radio) => { radio.checked = false; });
    const select = document.querySelector(".delivery-select-timeSlot .delivery-select");
    if (select) {
      select.value = "";
      updatePlaceholderState(select);
    }
  }

  function hasMeaningfulDraftData() {
    if (typeof state !== "undefined" && state.editingOrder) return true;
    if (document.getElementById("reference")?.value.trim()) return true;
    if (document.getElementById("requiredDate")?.value) return true;
    if (document.getElementById("deliveryAddressSearch")?.value.trim()) return true;
    return [...document.querySelectorAll(".quantity-input")].some((input) => Number(input.value) > 0);
  }

  function patchTimeSlotValidation() {
    if (typeof window.validateForm !== "function" || window.validateForm.__timeSlotPatched) return;
    const originalValidateForm = window.validateForm;
    const patched = function validateFormWithTimeSlot(...args) {
      const selected = document.querySelector('input[name="timeSlot"]:checked');
      if (!selected) {
        document.querySelector(".delivery-select-timeSlot .delivery-select")?.focus();
        throw new Error("Choose a time slot.");
      }
      return originalValidateForm.apply(this, args);
    };
    patched.__timeSlotPatched = true;
    window.validateForm = patched;
  }

  function patchBoardRenderer() {
    if (typeof window.renderUnifiedFloorSheet !== "function" || window.renderUnifiedFloorSheet.__ceilingTilePatched) return;
    const originalRenderer = window.renderUnifiedFloorSheet;
    const patched = function renderFloorWithoutCeilingTile(...args) {
      stripCeilingTileFromLayout();
      const result = originalRenderer.apply(this, args);
      removeRenderedCeilingTileSections();
      return result;
    };
    patched.__ceilingTilePatched = true;
    window.renderUnifiedFloorSheet = patched;
  }

  function removeCeilingTileProduct() {
    stripCeilingTileFromLayout();
    removeRenderedCeilingTileSections();
  }

  function stripCeilingTileFromLayout() {
    if (typeof state === "undefined") return;
    if (state.catalog) delete state.catalog.pdf_knauf_nova_ceiling_tiles;
    if (!state.layout) return;
    if (state.layout.sections) delete state.layout.sections.knauf_tiles;
    if (Array.isArray(state.layout.lowerColumns)) {
      state.layout.lowerColumns = state.layout.lowerColumns.map((column) =>
        Array.isArray(column) ? column.filter((id) => id !== "knauf_tiles") : column
      );
    }
  }

  function removeRenderedCeilingTileSections() {
    document.querySelectorAll(".pdf-product-section").forEach((section) => {
      if (TILE_PATTERN.test(section.textContent || "")) section.remove();
    });
  }

  function patchAreaCounts() {
    if (typeof window.renderCounts !== "function" || window.renderCounts.__areaCountsPatched) return;
    const originalRenderCounts = window.renderCounts;
    const patched = function renderCountsWithAreaBadges(...args) {
      const result = originalRenderCounts.apply(this, args);
      updateAreaCounts();
      return result;
    };
    patched.__areaCountsPatched = true;
    window.renderCounts = patched;
    try { renderCounts = patched; } catch (_error) { }
  }

  function polishDeliveryAreaTabs() {
    document.querySelectorAll(".area-tab-shell").forEach((shell) => {
      const tab = shell.querySelector("[data-floor-tab]");
      if (!tab) return;
      const areaId = tab.dataset.floorTab;
      let label = tab.querySelector(".area-tab-label");
      if (!label) {
        const text = tab.textContent.trim();
        label = document.createElement("span");
        label.className = "area-tab-label";
        label.textContent = text;
        const badge = document.createElement("span");
        badge.className = "area-tab-count";
        badge.dataset.areaCount = areaId;
        badge.hidden = true;
        tab.replaceChildren(label, badge);
      }
    });

    const add = document.querySelector("[data-add-area]");
    if (add && add.textContent !== "+") {
      add.textContent = "+";
      add.title = "Add tab";
      add.setAttribute("aria-label", "Add tab");
    }
    updateAreaCounts();
  }

  function updateAreaCounts() {
    if (typeof state === "undefined" || !Array.isArray(state.deliveryAreas)) return;
    state.deliveryAreas.forEach((area) => {
      const badge = [...document.querySelectorAll("[data-area-count]")]
        .find((item) => item.dataset.areaCount === area.id);
      if (!badge) return;
      let count = 0;
      const quantities = state.quantities?.[area.id];
      if (quantities instanceof Map) count += [...quantities.values()].filter((quantity) => Number(quantity) > 0).length;
      if (Array.isArray(state.otherMaterials?.[area.id])) {
        count += state.otherMaterials[area.id].filter((item) => Number(item.quantity) > 0).length;
      }
      badge.textContent = String(count);
      badge.hidden = count === 0;
      const tab = badge.closest("[data-floor-tab]");
      if (tab) tab.title = `${area.label} · ${count} product line${count === 1 ? "" : "s"} · Double-click to rename`;
    });
  }
})();