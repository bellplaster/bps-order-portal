(() => {
  if (window.__bpsAccountSmallLayoutFixStarted) return;
  window.__bpsAccountSmallLayoutFixStarted = true;

  const SAVED_ADDRESS_FIELD_IDS = [
    "savedAddressLabel",
    "savedAddressStreet",
    "savedAddressSuburb",
    "savedAddressPostcode",
  ];

  let reconcileScheduled = false;

  function applySidebarHeading() {
    const brand = document.querySelector(".account-sidebar-brand-v2");
    if (!(brand instanceof HTMLElement)) return false;

    const heading = brand.querySelector("strong");
    if (heading && (heading.textContent || "").trim() !== "Accounts") {
      heading.textContent = "Accounts";
    }

    brand.querySelector("span")?.remove();

    if (brand.dataset.accountsHeading !== "true") {
      brand.dataset.accountsHeading = "true";
    }
    return true;
  }

  function repairAdminConfirmationDialog() {
    const submit = document.getElementById("adminConfirmSubmit");
    if (submit && !document.getElementById("adminConfirmButton")) submit.id = "adminConfirmButton";

    const label = document.getElementById("adminConfirmFieldLabel");
    if (label && !document.getElementById("adminConfirmLabel")) label.id = "adminConfirmLabel";

    return Boolean(document.getElementById("adminConfirmButton") && document.getElementById("adminConfirmLabel"));
  }

  function removeInlineDefaultActions(root = document) {
    root.querySelectorAll?.("#savedAddressesList [data-default]").forEach((button) => button.remove());
  }

  function clearSavedAddressForm({ clearValues = true } = {}) {
    const form = document.getElementById("savedAddressForm");
    if (!(form instanceof HTMLFormElement)) return false;

    if (clearValues) form.reset();

    SAVED_ADDRESS_FIELD_IDS.forEach((id) => {
      const field = document.getElementById(id);
      if (!(field instanceof HTMLInputElement)) return;
      if (clearValues) field.value = "";
      field.setCustomValidity("");
      field.removeAttribute("aria-invalid");
      field.classList.remove("is-account-field-invalid");

      const error = document.getElementById(`${id}ValidationMessage`);
      if (error) {
        error.textContent = "";
        error.hidden = true;
      }

      const wrapper = field.closest("label");
      wrapper?.classList.remove("is-floating", "is-invalid");
    });

    if (clearValues) {
      const checkbox = document.getElementById("savedAddressDefault");
      if (checkbox instanceof HTMLInputElement) checkbox.checked = false;
    }

    return true;
  }

  function syncSavedAddressFloatingFields() {
    SAVED_ADDRESS_FIELD_IDS.forEach((id) => {
      const field = document.getElementById(id);
      if (!(field instanceof HTMLInputElement)) return;
      field.closest("label")?.classList.toggle("is-floating", Boolean(field.value));
    });
  }

  function installAddressInteractionReset() {
    if (document.documentElement.dataset.savedAddressResetInstalled === "true") return;
    document.documentElement.dataset.savedAddressResetInstalled = "true";

    document.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      if (target.closest("#addSavedAddress, #addFirstSavedAddress")) {
        clearSavedAddressForm();
        requestAnimationFrame(syncSavedAddressFloatingFields);
        return;
      }

      if (target.closest("#savedAddressDialog [data-close-address]")) {
        window.setTimeout(() => clearSavedAddressForm(), 0);
      }
    }, true);

    document.addEventListener("cancel", (event) => {
      if (event.target?.id === "savedAddressDialog") window.setTimeout(() => clearSavedAddressForm(), 0);
    }, true);
  }

  function reconcileDynamicAccountUi() {
    applySidebarHeading();
    repairAdminConfirmationDialog();
    removeInlineDefaultActions();
  }

  function scheduleReconcile() {
    if (reconcileScheduled) return;
    reconcileScheduled = true;
    window.requestAnimationFrame(() => {
      reconcileScheduled = false;
      reconcileDynamicAccountUi();
    });
  }

  function nodeNeedsReconcile(node) {
    if (!(node instanceof Element)) return false;
    return node.matches(
      ".account-sidebar-brand-v2, #savedAddressesList, #adminConfirmSubmit, #adminConfirmFieldLabel",
    ) || Boolean(node.querySelector(
      ".account-sidebar-brand-v2, #savedAddressesList [data-default], #adminConfirmSubmit, #adminConfirmFieldLabel",
    ));
  }

  function observeDynamicAccountUi() {
    const observer = new MutationObserver((mutations) => {
      let shouldReconcile = false;

      mutations.forEach((mutation) => {
        if (mutation.type === "attributes") {
          if (mutation.target?.id === "savedAddressDialog" && !mutation.target.hasAttribute("open")) {
            clearSavedAddressForm();
          }
          return;
        }

        if ([...mutation.addedNodes].some(nodeNeedsReconcile)) {
          shouldReconcile = true;
        }
      });

      if (shouldReconcile) scheduleReconcile();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["open"],
    });
  }

  function start() {
    reconcileDynamicAccountUi();
    installAddressInteractionReset();
    observeDynamicAccountUi();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once:true });
  else start();
})();
