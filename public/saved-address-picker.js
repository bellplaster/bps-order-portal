(() => {
  if (window.__bpsSavedAddressPickerStarted) return;
  window.__bpsSavedAddressPickerStarted = true;

  let addresses = [];
  let wrapper = null;
  let button = null;
  let menu = null;

  async function start() {
    const input = document.getElementById("deliveryAddressSearch");
    wrapper = input?.closest(".address-control");
    if (!(input instanceof HTMLInputElement) || !wrapper) return;

    try {
      const response = await fetch("/api/account-addresses", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return;
      const result = await response.json().catch(() => ({}));
      addresses = Array.isArray(result.addresses) ? result.addresses : [];
      if (!addresses.length) return;
      install(input);
      syncDisabledState(input);
    } catch (_error) {
      // Manual address entry remains available if saved addresses cannot load.
    }
  }

  function install(input) {
    if (document.getElementById("savedAddressPickerButton")) return;
    wrapper.classList.add("has-saved-address-picker");

    button = document.createElement("button");
    button.id = "savedAddressPickerButton";
    button.className = "saved-address-picker-button";
    button.type = "button";
    button.setAttribute("aria-label", "Choose a saved delivery address");
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");
    button.title = "Choose a saved address";
    button.innerHTML = locationIcon();

    menu = document.createElement("div");
    menu.id = "savedAddressPickerMenu";
    menu.className = "saved-address-picker-menu";
    menu.setAttribute("role", "listbox");
    menu.hidden = true;
    renderMenu();

    wrapper.append(button, menu);
    button.addEventListener("click", () => menu.hidden ? openMenu(input) : closeMenu(true));
    button.addEventListener("keydown", (event) => {
      if (["ArrowDown", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openMenu(input);
      }
    });
    menu.addEventListener("keydown", handleMenuKeydown);
    document.addEventListener("mousedown", (event) => {
      if (wrapper && !wrapper.contains(event.target)) closeMenu();
    });
    document.querySelectorAll('input[name="deliveryType"]').forEach((radio) => {
      radio.addEventListener("change", () => syncDisabledState(input));
    });
  }

  function renderMenu() {
    if (!menu) return;
    menu.innerHTML = `
      <div class="saved-address-picker-heading"><span>Saved delivery addresses</span><span>${addresses.length}</span></div>
      ${addresses.map((address, index) => `
        <button class="saved-address-picker-option" type="button" role="option" data-address-index="${index}">
          <span class="saved-address-picker-icon" aria-hidden="true">${locationIcon()}</span>
          <span class="saved-address-picker-copy"><strong>${escapeHtml(address.label)}</strong><span>${escapeHtml(address.formattedAddress)}</span></span>
          ${address.isDefault ? '<span class="saved-address-picker-default">Default</span>' : ""}
        </button>`).join("")}
      <div class="saved-address-picker-footer"><a href="/account/#savedAddressesSection">Manage saved addresses</a></div>`;

    menu.querySelectorAll("[data-address-index]").forEach((option) => {
      option.addEventListener("click", () => chooseAddress(Number(option.dataset.addressIndex)));
    });
  }

  function openMenu(input) {
    if (!menu || !button || input.disabled) return;
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
    menu.querySelector(".saved-address-picker-option")?.focus({ preventScroll: true });
  }

  function closeMenu(restoreFocus = false) {
    if (!menu || !button) return;
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
    if (restoreFocus) button.focus({ preventScroll: true });
  }

  function chooseAddress(index) {
    const address = addresses[index];
    if (!address) return;

    const values = {
      deliveryAddressSearch: address.formattedAddress,
      deliveryAddress: address.formattedAddress,
      deliveryAddressLine1: address.street,
      deliveryAddressLine2: `${address.suburb} ${address.state || "VIC"} ${address.postcode}`.replace(/\s+/g, " ").trim(),
    };

    Object.entries(values).forEach(([id, value]) => {
      const field = document.getElementById(id);
      if (!field) return;
      field.value = value || "";
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const clear = document.getElementById("clearAddressButton");
    if (clear) clear.hidden = false;
    if (typeof window.scheduleDraft === "function") window.scheduleDraft();
    else if (typeof scheduleDraft === "function") scheduleDraft();
    closeMenu();
    document.getElementById("deliveryAddressSearch")?.focus({ preventScroll: true });
  }

  function handleMenuKeydown(event) {
    if (!menu) return;
    const options = [...menu.querySelectorAll(".saved-address-picker-option")];
    const current = options.indexOf(document.activeElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      options[(current + direction + options.length) % options.length]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
    } else if (event.key === "Tab") {
      closeMenu();
    }
  }

  function syncDisabledState(input) {
    if (!button) return;
    button.disabled = input.disabled;
    if (input.disabled) closeMenu();
  }

  function locationIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"></path><circle cx="12" cy="10" r="2.2"></circle></svg>';
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void start(), { once: true });
  else void start();
})();
