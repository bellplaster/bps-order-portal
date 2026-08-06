(() => {
  const MAX_QUANTITY = 10000;
  const EXTRAS_PLACEHOLDER = "Select extras (optional)";

  function restoreNativeRequiredDate() {
    const input = document.getElementById("requiredDate");
    if (!input) return;

    document.getElementById("requiredDateDisplay")?.remove();
    document.querySelectorAll(".required-date-display, .date-leading-icon").forEach((node) => node.remove());

    input.type = "date";
    input.hidden = false;
    input.disabled = false;
    input.tabIndex = 0;
    input.classList.remove("date-native-picker");
    input.removeAttribute("style");
    input.removeAttribute("aria-hidden");
    input.setAttribute("aria-label", "Required date");

    const label = input.closest(".sheet-field-row")?.querySelector("label");
    if (label) label.htmlFor = "requiredDate";

    const shell = input.closest(".date-input-shell");
    if (shell) shell.replaceWith(input);
  }

  function updateExtrasPlaceholder() {
    if (document.querySelector('input[name="deliveryExtra"]:checked')) return;
    document.querySelectorAll(".extras-dropdown > summary > span").forEach((label) => {
      if (label.textContent !== EXTRAS_PLACEHOLDER) label.textContent = EXTRAS_PLACEHOLDER;
      label.closest("summary")?.classList.add("is-placeholder");
    });
  }

  function configureQuantityInput(input) {
    if (!(input instanceof HTMLInputElement) || !input.classList.contains("quantity-input")) return;
    input.maxLength = 5;
    input.inputMode = "numeric";
    input.pattern = "[0-9]*";
    input.setAttribute("aria-valuemax", String(MAX_QUANTITY));
    input.classList.toggle("is-large-quantity", String(input.value || "").length >= 4);
  }

  function quantityContext(input) {
    const appState = typeof state !== "undefined" ? state : null;
    const floor = input.dataset.floor
      || input.closest("[data-floor-panel]")?.dataset.floorPanel
      || input.closest("[data-selected-additional]")?.dataset.selectedAdditional;
    const productKey = input.dataset.productKey;

    if (appState && floor && productKey && appState.quantities?.[floor] instanceof Map) {
      return {
        set(quantity) {
          if (quantity > 0) appState.quantities[floor].set(productKey, quantity);
          else appState.quantities[floor].delete(productKey);
        },
      };
    }

    const row = input.closest(".selected-additional-row");
    const sku = row?.querySelector("strong")?.textContent?.trim();
    const materials = appState && floor && Array.isArray(appState.otherMaterials?.[floor])
      ? appState.otherMaterials[floor]
      : null;
    const item = materials?.find((candidate) => String(candidate.sku).trim() === sku);
    return item ? { set(quantity) { item.quantity = Math.max(1, quantity || 1); } } : null;
  }

  function normaliseQuantityInput(input, rawValue) {
    const digits = String(rawValue ?? input.value ?? "").replace(/\D/g, "").slice(0, 5);
    const quantity = Math.min(MAX_QUANTITY, Number(digits || 0));
    input.value = digits ? String(quantity) : "";
    input.classList.toggle("has-value", quantity > 0);
    input.classList.toggle("is-large-quantity", String(input.value || "").length >= 4);
    quantityContext(input)?.set(quantity);
    if (typeof renderCounts === "function") renderCounts();
    if (typeof scheduleDraft === "function") scheduleDraft();
  }

  function visibleQuantityInputs() {
    const activePanel = document.querySelector('.floor-panel.is-active:not([hidden]), .floor-panel[data-floor-panel]:not([hidden])');
    const root = activePanel || document;
    return [...root.querySelectorAll(".quantity-input")].filter((input) => !input.disabled && input.offsetParent !== null);
  }

  function focusQuantity(input) {
    if (!input) return;
    input.focus({ preventScroll: true });
    input.select();
    input.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function tableQuantityTarget(input, key) {
    const cell = input.closest("td");
    const row = cell?.parentElement;
    const table = cell?.closest("table");
    if (!cell || !row || !table) return null;

    if (key === "ArrowLeft" || key === "ArrowRight") {
      const direction = key === "ArrowRight" ? 1 : -1;
      for (let index = cell.cellIndex + direction; index >= 0 && index < row.cells.length; index += direction) {
        const candidate = row.cells[index]?.querySelector(".quantity-input");
        if (candidate && !candidate.disabled) return candidate;
      }
      return null;
    }

    const direction = key === "ArrowDown" ? 1 : -1;
    const rows = [...table.rows];
    const rowIndex = rows.indexOf(row);
    for (let index = rowIndex + direction; index >= 0 && index < rows.length; index += direction) {
      const candidate = rows[index]?.cells[cell.cellIndex]?.querySelector(".quantity-input");
      if (candidate && !candidate.disabled) return candidate;
    }
    return null;
  }

  function moveQuantityFocus(input, key) {
    const tableTarget = tableQuantityTarget(input, key);
    if (tableTarget) return focusQuantity(tableTarget);
    const inputs = visibleQuantityInputs();
    const index = inputs.indexOf(input);
    if (index < 0) return;
    const direction = key === "ArrowRight" || key === "ArrowDown" ? 1 : -1;
    focusQuantity(inputs[index + direction]);
  }

  function initialiseQuantityControls() {
    if (window.__bpsQuantityControlsStarted) return;
    window.__bpsQuantityControlsStarted = true;
    document.querySelectorAll(".quantity-input").forEach(configureQuantityInput);

    document.addEventListener("input", (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || !input.classList.contains("quantity-input")) return;
      input.dataset.pendingQuantity = input.value.replace(/\D/g, "").slice(0, 5);
    }, true);

    document.addEventListener("input", (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || !input.classList.contains("quantity-input")) return;
      normaliseQuantityInput(input, input.dataset.pendingQuantity);
      delete input.dataset.pendingQuantity;
    });

    document.addEventListener("keydown", (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || !input.classList.contains("quantity-input")) return;
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      moveQuantityFocus(input, event.key);
    });
  }

  function mutationTouchesExtras(record) {
    const target = record.target instanceof Element ? record.target : record.target.parentElement;
    if (target?.closest?.(".extras-dropdown")) return true;
    return [...record.addedNodes].some((node) => {
      const element = node instanceof Element ? node : node.parentElement;
      return Boolean(element?.closest?.(".extras-dropdown") || element?.querySelector?.(".extras-dropdown"));
    });
  }

  function observeDynamicControls() {
    let extrasQueued = false;
    const queueExtrasRefresh = () => {
      if (extrasQueued) return;
      extrasQueued = true;
      queueMicrotask(() => {
        extrasQueued = false;
        updateExtrasPlaceholder();
      });
    };

    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches(".quantity-input")) configureQuantityInput(node);
          node.querySelectorAll?.(".quantity-input").forEach(configureQuantityInput);
        });
        if (mutationTouchesExtras(record)) queueExtrasRefresh();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function start() {
    restoreNativeRequiredDate();
    initialiseQuantityControls();
    updateExtrasPlaceholder();
    observeDynamicControls();

    document.addEventListener("change", (event) => {
      if (event.target instanceof HTMLInputElement && event.target.name === "deliveryExtra") {
        queueMicrotask(updateExtrasPlaceholder);
      }
    });

    const confirmation = document.getElementById("futureDateConfirmation");
    if (confirmation) {
      const text = confirmation.querySelector("span");
      if (text) text.textContent = "Confirm this date";
      confirmation.title = "This required date is more than six months away";
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();

  const style = document.createElement("style");
  style.dataset.phoneDateRefinement = "true";
  style.textContent = `
    .order-form-page #requiredDate{box-sizing:border-box!important;width:100%!important;height:39px!important;min-height:39px!important;margin:0!important;padding:0 14px 0 16px!important;color:#17211f!important;background:#fff!important;border:0!important;border-radius:0!important;outline:0!important;font:400 12px/1.35 Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;text-align:left!important;cursor:pointer!important;color-scheme:light!important}
    .order-form-page #requiredDate:focus{position:relative!important;z-index:2!important;box-shadow:inset 0 0 0 2px var(--bell-green)!important}
    .order-form-page #requiredDate::-webkit-calendar-picker-indicator{width:16px!important;height:16px!important;margin-left:auto!important;padding:2px!important;opacity:.78!important;cursor:pointer!important}
    .quantity-input.is-large-quantity{font-size:9px!important;letter-spacing:-.25px!important}
    .future-confirmation:not([hidden]){display:inline-flex!important;align-items:center!important;gap:6px!important;min-width:142px!important;height:39px!important;margin:0!important;padding:0 9px!important;border:0!important;border-left:1px solid #ead9a6!important;background:#fff9ed!important;color:#725300!important;font-size:9px!important;font-weight:650!important;line-height:1!important;white-space:nowrap!important}
    .future-confirmation input[type="checkbox"]{width:13px!important;height:13px!important;min-height:13px!important;flex:0 0 13px!important;margin:0!important}
    .selected-additional:has(>.empty-state){height:0!important;min-height:0!important;max-height:0!important;overflow:hidden!important}
    .selected-additional>.empty-state{display:none!important}
    @media(max-width:760px){.future-confirmation:not([hidden]){min-width:0!important;width:100%!important;height:31px!important;border-left:0!important;border-top:1px solid #ead9a6!important}}
  `;
  document.head.append(style);
})();
