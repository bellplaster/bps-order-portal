(() => {
  const TILE_PATTERN = /KNAUF\s+CEILING\s+TILES|SHEETROCK\s+Nova\s+Ceiling\s+Tiles/i;
  let timeSlotTouched = false;
  let attempts = 0;

  simplifyStepNavigation();
  patchBoardRenderer();
  patchTimeSlotValidation();
  patchUnifiedDeliverySync();
  removeCeilingTileProduct();
  polishDeliveryControls();

  const retryTimer = window.setInterval(() => {
    attempts += 1;
    patchBoardRenderer();
    patchTimeSlotValidation();
    patchUnifiedDeliverySync();
    removeCeilingTileProduct();
    polishDeliveryControls();

    const controlsReady = Boolean(
      document.querySelector(".delivery-select-timeSlot .delivery-select")
      && document.querySelector(".delivery-select-deliveryType .delivery-select")
      && document.querySelector(".extras-dropdown > summary")
    );
    const layoutReady = typeof state !== "undefined" && Boolean(state.layout);
    if ((controlsReady && layoutReady) || attempts >= 50) window.clearInterval(retryTimer);
  }, 100);

  document.getElementById("orderForm")?.addEventListener("reset", () => {
    timeSlotTouched = false;
    window.setTimeout(() => {
      clearTimeSlotSelection();
      polishDeliveryControls();
    }, 0);
  });

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
    if (!timeSlotTouched && freshOrder && selectedTime?.value === "ANY") {
      clearTimeSlotSelection();
    } else if (!selectedTime) {
      timeSelect.value = "";
    }

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
    document.querySelectorAll('input[name="timeSlot"]').forEach((radio) => {
      radio.checked = false;
    });
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
        const select = document.querySelector(".delivery-select-timeSlot .delivery-select");
        select?.focus();
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
})();