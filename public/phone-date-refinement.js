(() => {
  const MAX_QUANTITY = 10000;
  const EXTRAS_PLACEHOLDER = "Select extras (optional)";

  const phone = {
    normalise(value, optional = false) {
      let digits = String(value || "").replace(/\D/g, "");
      if (!digits && optional) return "";
      if (digits.startsWith("61") && digits.length >= 11) digits = `0${digits.slice(2)}`;
      if (/^04\d{8}$/.test(digits)) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
      if (/^0[2378]\d{8}$/.test(digits)) return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`;
      if (/^(?:1300|1800)\d{6}$/.test(digits)) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
      if (/^13\d{4}$/.test(digits)) return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`;
      return "";
    },
    formatTyping(value) {
      let digits = String(value || "").replace(/\D/g, "");
      if (digits.startsWith("61")) digits = `0${digits.slice(2)}`;
      digits = digits.slice(0, 10);
      if (digits.startsWith("04")) return [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7)].filter(Boolean).join(" ");
      if (/^0[2378]/.test(digits)) return [digits.slice(0, 2), digits.slice(2, 6), digits.slice(6)].filter(Boolean).join(" ");
      if (/^(1300|1800)/.test(digits)) return [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7)].filter(Boolean).join(" ");
      if (digits.startsWith("13")) return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6)].filter(Boolean).join(" ");
      return digits;
    },
  };

  function addressTitleCase(value) {
    const cleaned = String(value || "")
      .replace(/,?\s*Australia\s*$/i, "")
      .replace(/\bVictoria\b/gi, "VIC")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) return "";
    return cleaned
      .toLowerCase()
      .replace(/\b([a-z])/g, (match) => match.toUpperCase())
      .replace(/\bVic\b/g, "VIC")
      .replace(/\bNsw\b/g, "NSW")
      .replace(/\bQld\b/g, "QLD")
      .replace(/\bSa\b/g, "SA")
      .replace(/\bWa\b/g, "WA")
      .replace(/\bAct\b/g, "ACT")
      .replace(/\bNt\b/g, "NT");
  }

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

  function cleanReference(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function initialiseReference() {
    const input = document.getElementById("reference");
    if (!input) return;
    input.placeholder = "Reference";
    input.inputMode = "numeric";
    input.pattern = "[0-9]*";
    input.maxLength = 30;
    input.value = cleanReference(input.value);
    if (input.dataset.numericReference === "true") return;
    input.dataset.numericReference = "true";
    input.addEventListener("input", () => {
      const cleaned = cleanReference(input.value);
      if (input.value !== cleaned) input.value = cleaned;
    });
  }

  function patchReferenceSetValue() {
    if (typeof setValue !== "function" || setValue.__numericReference) return;
    const original = setValue;
    const patched = function setNumericReference(id, nextValue, ...args) {
      return original.call(this, id, id === "reference" ? cleanReference(nextValue) : nextValue, ...args);
    };
    patched.__numericReference = true;
    try { setValue = patched; } catch (_error) { }
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

  window.BPSPhone = phone;
  window.formatAddressDisplay = addressTitleCase;
  if (typeof normaliseMobile === "function") normaliseMobile = (value, optional = false) => phone.normalise(value, optional);
  if (typeof formatMobileTyping === "function") formatMobileTyping = (value) => phone.formatTyping(value);
  if (typeof formatMobileField === "function") formatMobileField = (event) => { event.target.value = phone.formatTyping(event.target.value); };

  document.addEventListener("DOMContentLoaded", () => {
    [document.getElementById("contactMobile"), document.getElementById("defaultMobile"), document.getElementById("newDefaultMobile")]
      .filter(Boolean)
      .forEach((input) => {
        input.maxLength = 16;
        input.placeholder = "Phone";
        input.setAttribute("aria-label", "Phone");
      });

    restoreNativeRequiredDate();
    initialiseReference();
    patchReferenceSetValue();
    initialiseQuantityControls();
    updateExtrasPlaceholder();
    observeDynamicControls();

    document.addEventListener("change", (event) => {
      if (event.target instanceof HTMLInputElement && event.target.name === "deliveryExtra") {
        queueMicrotask(updateExtrasPlaceholder);
      }
    });

    const address = document.getElementById("deliveryAddressSearch");
    if (address) {
      const refine = () => {
        if (address.value && address.value !== "Pickup") address.value = addressTitleCase(address.value);
      };
      address.addEventListener("change", refine);
      address.addEventListener("blur", refine);
    }

    const confirmation = document.getElementById("futureDateConfirmation");
    if (confirmation) {
      const text = confirmation.querySelector("span");
      if (text) text.textContent = "Confirm this date";
      confirmation.title = "This required date is more than six months away";
    }

    let attempts = 0;
    const repairTimer = window.setInterval(() => {
      attempts += 1;
      restoreNativeRequiredDate();
      initialiseReference();
      patchReferenceSetValue();
      updateExtrasPlaceholder();
      document.querySelectorAll(".quantity-input").forEach(configureQuantityInput);
      if (attempts >= 50) window.clearInterval(repairTimer);
    }, 100);
  });

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