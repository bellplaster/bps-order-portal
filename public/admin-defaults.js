(() => {
  const clone = (value) => {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value || {}));
  };

  function showAccountMessage(message, type = "success") {
    if (typeof showMessage === "function") {
      showMessage(message, type);
      return;
    }
    const root = document.getElementById("accountMessage");
    if (!root) return;
    root.textContent = message;
    root.className = `portal-message is-${type}`;
    root.hidden = false;
  }

  async function fetchJsonSafe(url, options = {}) {
    if (typeof fetchJson === "function") return fetchJson(url, options);
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.error || `Request failed (${response.status}).`);
    return payload;
  }

  function ensureAnyTimeSlotOption() {
    const accountSelect = document.getElementById("defaultTimeSlot");
    if (accountSelect && !accountSelect.querySelector('option[value="ANY"]')) {
      accountSelect.append(new Option("Any", "ANY"));
    }

    const sourceRadio = document.querySelector('input[name="timeSlot"][value="ANY"]');
    const orderSelect = document.querySelector(".delivery-select-timeSlot .delivery-select");
    if (orderSelect && !orderSelect.querySelector('option[value="ANY"]')) {
      orderSelect.append(new Option("Any", "ANY"));
    }

    const savedAccountSlot = typeof data !== "undefined"
      ? String(data?.profile?.orderDefaults?.timeSlot || "").toUpperCase()
      : "";
    if (accountSelect && savedAccountSlot === "ANY") accountSelect.value = "ANY";

    const savedOrderSlot = typeof state !== "undefined"
      ? String(state.account?.orderDefaults?.timeSlot || "").toUpperCase()
      : "";
    if (savedOrderSlot === "ANY" && sourceRadio && orderSelect) {
      sourceRadio.checked = true;
      orderSelect.value = "ANY";
      orderSelect.classList.remove("is-placeholder");
    }
  }

  function collectDefaultsFromAccountPage() {
    return {
      reference: document.getElementById("defaultReference")?.value || "",
      requiredDate: document.getElementById("defaultRequiredDate")?.value || "",
      street: document.getElementById("defaultStreet")?.value || "",
      suburb: document.getElementById("defaultSuburb")?.value || "",
      state: "VIC",
      postcode: document.getElementById("defaultPostcode")?.value || "",
      timeSlot: document.getElementById("defaultTimeSlot")?.value || "",
      deliveryType: document.getElementById("defaultDeliveryType")?.value || "",
      instructions: document.getElementById("defaultInstructions")?.value || "",
    };
  }

  function revealAdminDefaultsForm() {
    const form = document.getElementById("accountForm");
    const adminSection = document.getElementById("adminSection");
    if (!form || !adminSection) return;

    document.getElementById("customerAccountCard")?.setAttribute("hidden", "");
    form.hidden = false;
    form.removeAttribute("hidden");
    form.classList.add("admin-order-defaults-form");

    if (form.nextElementSibling !== adminSection) {
      adminSection.parentElement?.insertBefore(form, adminSection);
    }
  }

  function keepAdminDefaultsVisible() {
    const form = document.getElementById("accountForm");
    const adminSection = document.getElementById("adminSection");
    if (!form || !adminSection || form.dataset.adminVisibilityGuard === "true") return;
    form.dataset.adminVisibilityGuard = "true";

    const repair = () => {
      if (typeof data !== "undefined" && data?.profile?.role === "admin") revealAdminDefaultsForm();
    };

    const observer = new MutationObserver(repair);
    observer.observe(form, { attributes: true, attributeFilter: ["hidden", "class"] });
    observer.observe(adminSection, { attributes: true, attributeFilter: ["hidden", "class"] });

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      repair();
      if (attempts >= 100) window.clearInterval(timer);
    }, 100);
  }

  async function initialiseAdminAccountDefaults() {
    if (!document.body.classList.contains("account-page")) return;
    const form = document.getElementById("accountForm");
    const adminSection = document.getElementById("adminSection");
    if (!form || !adminSection) return;

    let result;
    try {
      result = await fetchJsonSafe("/api/account");
    } catch (_error) {
      return;
    }
    const profile = result?.profile;
    if (profile?.role !== "admin") return;

    revealAdminDefaultsForm();
    keepAdminDefaultsVisible();
    ensureAnyTimeSlotOption();

    const defaults = profile.orderDefaults || {};
    const values = {
      defaultReference: defaults.reference || "",
      defaultRequiredDate: defaults.requiredDate || "",
      defaultContactName: profile.defaultContactName || "",
      defaultMobile: profile.defaultMobile || "",
      defaultStreet: defaults.street || "",
      defaultSuburb: defaults.suburb || "",
      defaultPostcode: defaults.postcode || "",
      defaultTimeSlot: defaults.timeSlot || "",
      defaultDeliveryType: defaults.deliveryType || "",
      defaultInstructions: defaults.instructions || "",
    };
    Object.entries(values).forEach(([id, value]) => {
      const field = document.getElementById(id);
      if (field) field.value = value;
    });

    if (form.dataset.adminDefaultsBound === "true") return;
    form.dataset.adminDefaultsBound = "true";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const button = form.querySelector('button[type="submit"], button:not([type])');
      if (button) button.disabled = true;
      try {
        await fetchJsonSafe("/api/admin-defaults", {
          method: "PUT",
          body: JSON.stringify({
            defaultContactName: document.getElementById("defaultContactName")?.value || "",
            defaultMobile: document.getElementById("defaultMobile")?.value || "",
            orderDefaults: collectDefaultsFromAccountPage(),
          }),
        });
        showAccountMessage("Administrator order defaults saved.", "success");
      } catch (error) {
        showAccountMessage(error.message || String(error), "error");
      } finally {
        if (button) button.disabled = false;
      }
    }, true);
  }

  async function initialiseAdminOrderDefaults() {
    if (!document.body.classList.contains("order-form-page")) return;

    let result;
    try {
      result = await fetchJsonSafe("/api/account");
    } catch (_error) {
      return;
    }
    const profile = result?.profile;
    if (profile?.role !== "admin") return;

    const ownDefaults = {
      defaultContactName: profile.defaultContactName || "",
      defaultMobile: profile.defaultMobile || "",
      orderDefaults: clone(profile.orderDefaults || {}),
    };

    const installWrapper = () => {
      if (typeof applyAdminOrderAccount !== "function") return false;
      if (applyAdminOrderAccount.__preservesAdminDefaults) return true;
      const original = applyAdminOrderAccount;
      const wrapped = function applyAdminAccountWithoutClearingDefaults(account) {
        const result = original.call(this, account);
        if (typeof state !== "undefined" && state.account?.role === "admin") {
          state.account.defaultContactName = ownDefaults.defaultContactName;
          state.account.defaultMobile = ownDefaults.defaultMobile;
          state.account.orderDefaults = clone(ownDefaults.orderDefaults);
        }
        return result;
      };
      wrapped.__preservesAdminDefaults = true;
      try { applyAdminOrderAccount = wrapped; } catch (_error) { }
      window.applyAdminOrderAccount = wrapped;
      return true;
    };

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      const installed = installWrapper();
      if (typeof state !== "undefined" && state.account?.role === "admin") {
        state.account.defaultContactName = ownDefaults.defaultContactName;
        state.account.defaultMobile = ownDefaults.defaultMobile;
        state.account.orderDefaults = clone(ownDefaults.orderDefaults);
      }
      ensureAnyTimeSlotOption();
      if (installed && typeof resetOrder === "function") {
        window.setTimeout(() => {
          resetOrder();
          ensureAnyTimeSlotOption();
        }, 0);
        window.clearInterval(timer);
      } else if (attempts >= 80) {
        window.clearInterval(timer);
      }
    }, 100);
  }

  function installExtrasBorderRepair() {
    if (!document.body.classList.contains("order-form-page")) return;
    if (document.getElementById("extrasBorderRepair")) return;
    const style = document.createElement("style");
    style.id = "extrasBorderRepair";
    style.textContent = `
      .order-form-page .extras-dropdown-field{
        box-sizing:border-box!important;
        overflow:visible!important;
        border-right:1px solid #cfd7d4!important;
      }
      .order-form-page .extras-dropdown-field .extras-dropdown{
        box-sizing:border-box!important;
        width:100%!important;
        max-width:100%!important;
        margin-right:0!important;
      }
      .order-form-page .extras-dropdown-field .extras-dropdown>summary,
      .order-form-page .extras-dropdown-field .extras-dropdown-menu{
        box-sizing:border-box!important;
        width:100%!important;
        min-width:100%!important;
        max-width:100%!important;
        right:auto!important;
      }
    `;
    document.head.append(style);
  }

  const start = () => {
    installExtrasBorderRepair();
    ensureAnyTimeSlotOption();
    initialiseAdminAccountDefaults();
    initialiseAdminOrderDefaults();

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      ensureAnyTimeSlotOption();
      if (attempts >= 80) window.clearInterval(timer);
    }, 100);
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();