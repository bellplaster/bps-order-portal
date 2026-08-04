(() => {
  if (window.__bpsAccountAddressesManagementStarted) return;
  window.__bpsAccountAddressesManagementStarted = true;

  const API = "/api/account-addresses";
  let addresses = [];
  let canManage = false;
  let editingId = null;

  async function request(path = "", options = {}) {
    const response = await fetch(`${API}${path}`, {
      credentials: "same-origin",
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
    if (response.status === 401) {
      window.location.replace("/signin/");
      throw new Error("Authentication required.");
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.error || "Saved address request failed.");
    return payload;
  }

  async function start() {
    try {
      const result = await request();
      addresses = Array.isArray(result.addresses) ? result.addresses : [];
      canManage = result.canManage === true;
      if (!addresses.length && !canManage) return;
      installSection();
      if (canManage) installDialog();
      render();
      document.dispatchEvent(new CustomEvent("bps:account-addresses-ready"));
    } catch (error) {
      showMessage(error.message || String(error), false);
    }
  }

  function installSection() {
    if (document.getElementById("savedAddressesSection")) return;
    const accountForm = document.getElementById("accountForm");
    if (!accountForm) return;

    const section = document.createElement("section");
    section.id = "savedAddressesSection";
    section.className = "account-section saved-addresses-section";
    section.innerHTML = `
      <header class="account-section-bar saved-addresses-bar">
        <div><h2>Saved addresses</h2><p>Choose these delivery sites when creating an order.</p></div>
        ${canManage ? '<button id="addSavedAddress" type="button">Add address</button>' : ""}
      </header>
      <div id="savedAddressesList" class="saved-addresses-list" aria-live="polite"></div>`;

    const contacts = document.getElementById("savedContactsSection");
    if (contacts) contacts.insertAdjacentElement("afterend", section);
    else accountForm.insertAdjacentElement("afterend", section);

    section.querySelector("#addSavedAddress")?.addEventListener("click", () => openDialog());
  }

  function installDialog() {
    if (document.getElementById("savedAddressDialog")) return;
    const dialog = document.createElement("dialog");
    dialog.id = "savedAddressDialog";
    dialog.className = "saved-address-dialog";
    dialog.innerHTML = `
      <form id="savedAddressForm" class="saved-address-dialog-card">
        <header>
          <div><h2 id="savedAddressTitle">Add saved address</h2><p>Shared with all order users under this account.</p></div>
          <button type="button" data-close-address aria-label="Close">×</button>
        </header>
        <div class="saved-address-fields">
          <label class="saved-address-field-wide"><span>Address name</span><input id="savedAddressLabel" maxlength="80" placeholder="Site office, Warehouse or Project name" required></label>
          <label class="saved-address-field-wide"><span>Street address</span><input id="savedAddressStreet" maxlength="240" autocomplete="street-address" required></label>
          <label><span>Suburb</span><input id="savedAddressSuburb" maxlength="120" autocomplete="address-level2" required></label>
          <label><span>Postcode</span><input id="savedAddressPostcode" maxlength="4" inputmode="numeric" autocomplete="postal-code" required></label>
          <label class="saved-address-default saved-address-field-wide"><input id="savedAddressDefault" type="checkbox"><span>Make this the default saved address</span></label>
        </div>
        <footer>
          <button class="button button-secondary" type="button" data-close-address>Cancel</button>
          <button class="button button-primary" type="submit">Save address</button>
        </footer>
      </form>`;
    document.body.append(dialog);

    dialog.querySelectorAll("[data-close-address]").forEach((button) => button.addEventListener("click", closeDialog));
    dialog.querySelector("form")?.addEventListener("submit", saveAddress);
    dialog.querySelector("#savedAddressPostcode")?.addEventListener("input", (event) => {
      event.target.value = event.target.value.replace(/\D/g, "").slice(0, 4);
    });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeDialog();
    });
  }

  function render() {
    const list = document.getElementById("savedAddressesList");
    if (!list) return;

    if (!addresses.length) {
      list.innerHTML = `
        <div class="saved-addresses-empty">
          <span class="saved-address-empty-icon" aria-hidden="true">⌖</span>
          <div><strong>No saved addresses yet</strong><p>Add frequently used delivery sites so orders can be completed faster.</p></div>
          ${canManage ? '<button id="addFirstSavedAddress" type="button">Add an address</button>' : ""}
        </div>`;
      list.querySelector("#addFirstSavedAddress")?.addEventListener("click", () => openDialog());
      return;
    }

    list.innerHTML = addresses.map((address) => `
      <article class="saved-address-row${address.isDefault ? " is-default" : ""}" data-address-id="${Number(address.id)}">
        <div class="saved-address-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"></path><circle cx="12" cy="10" r="2.2"></circle></svg>
        </div>
        <div class="saved-address-copy">
          <div class="saved-address-title"><strong>${escapeHtml(address.label)}</strong>${address.isDefault ? '<span>Default</span>' : ""}</div>
          <p>${escapeHtml(address.formattedAddress)}</p>
        </div>
        ${canManage ? `
          <div class="saved-address-actions">
            ${address.isDefault ? "" : `<button type="button" data-default="${Number(address.id)}">Set as default</button>`}
            <button type="button" data-edit="${Number(address.id)}">Edit</button>
            <button type="button" class="danger" data-remove="${Number(address.id)}">Remove</button>
          </div>` : ""}
      </article>`).join("");

    list.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => openDialog(Number(button.dataset.edit))));
    list.querySelectorAll("[data-remove]").forEach((button) => button.addEventListener("click", () => removeAddress(Number(button.dataset.remove))));
    list.querySelectorAll("[data-default]").forEach((button) => button.addEventListener("click", () => setDefault(Number(button.dataset.default))));
  }

  function openDialog(id = null) {
    if (!canManage) return;
    const address = addresses.find((item) => Number(item.id) === Number(id));
    editingId = address ? Number(address.id) : null;
    document.getElementById("savedAddressTitle").textContent = address ? "Edit saved address" : "Add saved address";
    document.getElementById("savedAddressLabel").value = address?.label || "";
    document.getElementById("savedAddressStreet").value = address?.street || "";
    document.getElementById("savedAddressSuburb").value = address?.suburb || "";
    document.getElementById("savedAddressPostcode").value = address?.postcode || "";
    document.getElementById("savedAddressDefault").checked = address?.isDefault === true || addresses.length === 0;
    const dialog = document.getElementById("savedAddressDialog");
    typeof dialog?.showModal === "function" ? dialog.showModal() : dialog?.setAttribute("open", "");
    requestAnimationFrame(() => document.getElementById("savedAddressLabel")?.focus());
  }

  function closeDialog() {
    const dialog = document.getElementById("savedAddressDialog");
    if (dialog?.open && typeof dialog.close === "function") dialog.close();
    else dialog?.removeAttribute("open");
    editingId = null;
  }

  async function saveAddress(event) {
    event.preventDefault();
    const wasEditing = Boolean(editingId);
    const body = {
      label: document.getElementById("savedAddressLabel").value,
      street: document.getElementById("savedAddressStreet").value,
      suburb: document.getElementById("savedAddressSuburb").value,
      postcode: document.getElementById("savedAddressPostcode").value,
      isDefault: document.getElementById("savedAddressDefault").checked,
      ...(editingId ? { addressId: editingId } : {}),
    };
    const submit = event.submitter || event.currentTarget.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      await request("", { method: editingId ? "PUT" : "POST", body: JSON.stringify(body) });
      closeDialog();
      await refresh();
      showMessage(wasEditing ? "Saved address updated." : "Saved address added.", true);
    } catch (error) {
      showMessage(error.message || String(error), false);
    } finally {
      if (submit) submit.disabled = false;
    }
  }

  async function setDefault(id) {
    try {
      await request("", { method: "PATCH", body: JSON.stringify({ addressId: id }) });
      await refresh();
      showMessage("Default saved address updated.", true);
    } catch (error) {
      showMessage(error.message || String(error), false);
    }
  }

  async function removeAddress(id) {
    const address = addresses.find((item) => Number(item.id) === Number(id));
    if (!address) return;
    const approved = await confirmRemoval({
      title: `Remove ${address.label}?`,
      message: "This address will no longer be available from the order form.",
      confirmLabel: "Remove address",
    });
    if (!approved) return;
    try {
      await request(`?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      await refresh();
      showMessage("Saved address removed.", true);
    } catch (error) {
      showMessage(error.message || String(error), false);
    }
  }

  async function confirmRemoval(options) {
    if (window.BPSAccountDialogs?.confirm) return window.BPSAccountDialogs.confirm(options);
    return window.confirm(`${options.title}\n\n${options.message}`);
  }

  async function refresh() {
    const result = await request();
    addresses = Array.isArray(result.addresses) ? result.addresses : [];
    canManage = result.canManage === true;
    render();
    document.dispatchEvent(new CustomEvent("bps:account-addresses-updated", { detail: { addresses } }));
  }

  function showMessage(text, success) {
    const root = document.getElementById("accountMessage");
    if (!root) return;
    root.textContent = text;
    root.hidden = false;
    root.className = `portal-message ${success ? "is-success" : "is-error"}`;
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

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else void start();
})();
