(() => {
  if (window.__bpsAccountShopifyFieldsStarted) return;
  window.__bpsAccountShopifyFieldsStarted = true;

  const FLOATING_FIELD_SELECTORS = [
    ".order-default-grid .account-field",
    ".saved-contact-fields label",
    ".saved-address-fields label:not(.saved-address-default)",
    ".password-modal-form-v2 .account-field",
  ].join(",");

  const PROCESSING_FORM_IDS = new Set([
    "accountForm",
    "savedContactForm",
    "savedAddressForm",
    "passwordForm",
    "editAccountForm",
    "createAccountForm",
    "createUserForm",
  ]);

  const processingForms = new Map();
  let resyncTimer = 0;

  function directControl(field) {
    return [...field.children].find((child) => child.matches?.("input,select,textarea")) || null;
  }

  function directLabel(field) {
    return [...field.children].find((child) => child.matches?.("span")) || null;
  }

  function controlHasValue(control) {
    if (!control) return false;
    if (control instanceof HTMLSelectElement) return String(control.value || "").trim() !== "";
    return String(control.value || "").trim() !== "";
  }

  function shouldAlwaysFloat(control) {
    return control instanceof HTMLInputElement && ["date", "datetime-local", "month", "time", "week"].includes(control.type);
  }

  function syncFloatingField(field) {
    const control = directControl(field);
    if (!control) return;
    const active = document.activeElement === control || controlHasValue(control) || shouldAlwaysFloat(control);
    field.classList.toggle("is-floating", active);
  }

  function enhanceFloatingField(field) {
    if (!(field instanceof HTMLElement) || field.dataset.shopifyField === "true") return;
    const control = directControl(field);
    const label = directLabel(field);
    if (!control || !label) return;

    field.dataset.shopifyField = "true";
    field.classList.add("account-shopify-field");
    if (control instanceof HTMLTextAreaElement) field.classList.add("is-textarea");

    if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
      control.dataset.originalPlaceholder = control.getAttribute("placeholder") || "";
      control.setAttribute("placeholder", " ");
    }

    if (control instanceof HTMLSelectElement) {
      const emptyOption = [...control.options].find((option) => option.value === "");
      if (emptyOption && emptyOption.dataset.shopifyEmptyOption !== "true") {
        emptyOption.dataset.shopifyEmptyOption = "true";
        emptyOption.dataset.originalText = emptyOption.textContent || "";
        emptyOption.textContent = "";
      }
    }

    const sync = () => syncFloatingField(field);
    control.addEventListener("input", sync);
    control.addEventListener("change", sync);
    control.addEventListener("focus", sync);
    control.addEventListener("blur", sync);
    sync();
  }

  function enhanceWithin(root = document) {
    if (root instanceof Element && root.matches(FLOATING_FIELD_SELECTORS)) enhanceFloatingField(root);
    root.querySelectorAll?.(FLOATING_FIELD_SELECTORS).forEach(enhanceFloatingField);
  }

  function syncAllFloatingFields() {
    document.querySelectorAll(".account-shopify-field").forEach(syncFloatingField);
  }

  function scheduleFloatingSync() {
    window.clearTimeout(resyncTimer);
    resyncTimer = window.setTimeout(syncAllFloatingFields, 0);
    window.setTimeout(syncAllFloatingFields, 60);
    window.setTimeout(syncAllFloatingFields, 180);
  }

  function closeSuggestionPanel(panel) {
    const ownerId = panel?.dataset.owner;
    const input = ownerId ? document.getElementById(ownerId) : null;
    if (typeof input?.__closeOrderDetailSuggestions === "function") input.__closeOrderDetailSuggestions();
    else if (panel) panel.hidden = true;
  }

  function decorateSuggestionPanel(panel) {
    if (!(panel instanceof HTMLElement) || panel.dataset.group !== "account") return;
    if (!panel.querySelector(".order-detail-suggestion")) return;
    if (panel.querySelector(":scope > .shopify-suggestion-header")) return;

    const header = document.createElement("div");
    header.className = "shopify-suggestion-header";
    header.innerHTML = '<span>Suggestions</span><span class="shopify-suggestion-close" role="button" tabindex="0" aria-label="Close address suggestions">×</span>';

    const close = header.querySelector(".shopify-suggestion-close");
    close.addEventListener("mousedown", (event) => event.preventDefault());
    close.addEventListener("click", () => closeSuggestionPanel(panel));
    close.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      closeSuggestionPanel(panel);
    });
    panel.prepend(header);
  }

  function decorateSuggestionPanels(root = document) {
    if (root instanceof Element && root.matches(".order-detail-suggestions[data-group='account']")) decorateSuggestionPanel(root);
    root.querySelectorAll?.(".order-detail-suggestions[data-group='account']").forEach(decorateSuggestionPanel);
  }

  function processingButton(form, event) {
    const submitted = event.submitter;
    if (submitted instanceof HTMLButtonElement) return submitted;
    return form.querySelector('button[type="submit"],button:not([type])');
  }

  function restoreProcessing(form) {
    const state = processingForms.get(form);
    if (!state) return;
    window.clearTimeout(state.fallbackTimer);
    state.button.textContent = state.label;
    state.button.disabled = state.wasDisabled;
    state.button.removeAttribute("aria-busy");
    state.button.removeAttribute("data-processing");
    processingForms.delete(form);
  }

  function startProcessing(form, button) {
    if (!form || !button || processingForms.has(form)) return;
    const state = {
      button,
      label:(button.textContent || "Save").trim(),
      wasDisabled:button.disabled,
      fallbackTimer:0,
    };
    button.textContent = "Processing...";
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.dataset.processing = "true";
    state.fallbackTimer = window.setTimeout(() => restoreProcessing(form), 20000);
    processingForms.set(form, state);
  }

  function restoreAllProcessing() {
    [...processingForms.keys()].forEach(restoreProcessing);
  }

  function installProcessingStates() {
    document.addEventListener("submit", (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || !PROCESSING_FORM_IDS.has(form.id)) return;
      const button = processingButton(form, event);
      if (button) startProcessing(form, button);
    }, true);

    document.addEventListener("reset", (event) => {
      if (event.target instanceof HTMLFormElement) restoreProcessing(event.target);
      scheduleFloatingSync();
    }, true);

    const message = document.getElementById("accountMessage");
    if (message) {
      const observer = new MutationObserver(() => {
        if (!processingForms.size || message.hidden || !(message.textContent || "").trim()) return;
        window.setTimeout(restoreAllProcessing, 120);
      });
      observer.observe(message, {
        attributes:true,
        attributeFilter:["hidden"],
        childList:true,
        characterData:true,
        subtree:true,
      });
    }
  }

  function installDynamicEnhancement() {
    const observer = new MutationObserver((records) => {
      let shouldSync = false;
      records.forEach((record) => {
        if (record.type === "attributes") {
          if (record.target instanceof HTMLDialogElement) {
            enhanceWithin(record.target);
            scheduleFloatingSync();
            if (!record.target.open) {
              record.target.querySelectorAll("form").forEach(restoreProcessing);
            }
          }
          return;
        }

        record.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          enhanceWithin(node);
          decorateSuggestionPanels(node);
          if (node.matches?.("input,select,textarea") || node.querySelector?.("input,select,textarea")) shouldSync = true;
        });

        if (record.target instanceof HTMLElement && record.target.matches(".order-detail-suggestions[data-group='account']")) {
          decorateSuggestionPanel(record.target);
        }
      });
      if (shouldSync) scheduleFloatingSync();
    });

    observer.observe(document.body, {
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:["open"],
    });
  }

  function installInteractionResync() {
    document.addEventListener("click", scheduleFloatingSync, true);
    document.addEventListener("focusin", (event) => {
      const field = event.target?.closest?.(".account-shopify-field");
      if (field) syncFloatingField(field);
    });
    document.addEventListener("focusout", (event) => {
      const field = event.target?.closest?.(".account-shopify-field");
      if (field) window.setTimeout(() => syncFloatingField(field), 0);
    });
  }

  function start() {
    enhanceWithin();
    decorateSuggestionPanels();
    installProcessingStates();
    installDynamicEnhancement();
    installInteractionResync();

    let checks = 0;
    const timer = window.setInterval(() => {
      checks += 1;
      enhanceWithin();
      decorateSuggestionPanels();
      syncAllFloatingFields();
      if (checks >= 50) window.clearInterval(timer);
    }, 100);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once:true });
  else start();
})();
