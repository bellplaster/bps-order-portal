(() => {
  if (window.__bpsAccountContactsManagementStarted) return;
  window.__bpsAccountContactsManagementStarted = true;

  const API = "/api/account-contacts";
  let contacts = [];
  let editingId = null;

  async function api(path = "", options = {}) {
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
    if (!response.ok || payload.ok === false) throw new Error(payload.error || "Saved contact request failed.");
    return payload;
  }

  async function start() {
    try {
      const result = await api();
      if (result.canManage !== true) return;
      contacts = Array.isArray(result.contacts) ? result.contacts : [];
      installSection();
      installDialog();
      render();
      document.dispatchEvent(new CustomEvent("bps:account-contacts-ready"));
    } catch (error) {
      message(error.message || String(error), false);
    }
  }

  function installSection() {
    if (document.getElementById("savedContactsSection")) return;
    const accountForm = document.getElementById("accountForm");
    if (!accountForm) return;
    const section = document.createElement("section");
    section.id = "savedContactsSection";
    section.className = "account-section saved-contacts-section";
    section.innerHTML = `
      <header class="account-section-bar saved-contacts-bar">
        <h2>Saved contacts</h2>
        <button id="addSavedContact" type="button">Add contact</button>
      </header>
      <div class="saved-contacts-table" role="table" aria-label="Saved contacts">
        <div class="saved-contacts-header" role="row"><span>Contact</span><span>Phone</span><span>Actions</span></div>
        <div id="savedContactsList"></div>
      </div>`;
    accountForm.insertAdjacentElement("afterend", section);
    section.querySelector("#addSavedContact").addEventListener("click", () => openDialog());
  }

  function installDialog() {
    if (document.getElementById("savedContactDialog")) return;
    const dialog = document.createElement("dialog");
    dialog.id = "savedContactDialog";
    dialog.className = "saved-contact-dialog";
    dialog.innerHTML = `
      <form id="savedContactForm" class="saved-contact-dialog-card">
        <header><div><h2 id="savedContactTitle">Add saved contact</h2><p>Available to all order users under this account.</p></div><button type="button" data-close-contact aria-label="Close">×</button></header>
        <div class="saved-contact-fields">
          <label><span>Contact name</span><input id="savedContactName" maxlength="100" autocomplete="name" required></label>
          <label><span>Phone</span><input id="savedContactMobile" type="tel" maxlength="16" inputmode="tel" autocomplete="tel"></label>
        </div>
        <footer><button class="button button-secondary" type="button" data-close-contact>Cancel</button><button class="button button-primary" type="submit">Save contact</button></footer>
      </form>`;
    document.body.append(dialog);
    dialog.querySelectorAll("[data-close-contact]").forEach((button) => button.addEventListener("click", closeDialog));
    dialog.querySelector("form").addEventListener("submit", saveContact);
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); closeDialog(); });
  }

  function render() {
    const list = document.getElementById("savedContactsList");
    if (!list) return;
    if (!contacts.length) {
      list.innerHTML = '<div class="saved-contacts-empty">No saved contacts yet. Add the people your team regularly orders for.</div>';
      return;
    }
    list.innerHTML = contacts.map((contact) => `
      <article class="saved-contact-row" role="row">
        <div class="saved-contact-main">
          <span class="saved-contact-avatar" aria-hidden="true">${escapeHtml(initials(contact.contactName))}</span>
          <div class="saved-contact-copy">
            <strong>${escapeHtml(contact.contactName)}</strong>
            <span>${escapeHtml(contact.mobile || "—")}</span>
          </div>
        </div>
        <div class="saved-contact-actions">
          <button type="button" data-edit="${Number(contact.id)}">Edit</button>
          <button type="button" class="danger" data-remove="${Number(contact.id)}">Remove</button>
        </div>
      </article>`).join("");
    list.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => openDialog(Number(button.dataset.edit))));
    list.querySelectorAll("[data-remove]").forEach((button) => button.addEventListener("click", () => removeContact(Number(button.dataset.remove))));
  }

  function openDialog(id = null) {
    const contact = contacts.find((item) => Number(item.id) === Number(id));
    editingId = contact ? Number(contact.id) : null;
    document.getElementById("savedContactTitle").textContent = contact ? "Edit saved contact" : "Add saved contact";
    document.getElementById("savedContactName").value = contact?.contactName || "";
    document.getElementById("savedContactMobile").value = contact?.mobile || "";
    const dialog = document.getElementById("savedContactDialog");
    typeof dialog.showModal === "function" ? dialog.showModal() : dialog.setAttribute("open", "");
    requestAnimationFrame(() => document.getElementById("savedContactName")?.focus());
  }

  function closeDialog() {
    const dialog = document.getElementById("savedContactDialog");
    if (dialog?.open && typeof dialog.close === "function") dialog.close(); else dialog?.removeAttribute("open");
    editingId = null;
  }

  async function saveContact(event) {
    event.preventDefault();
    const wasEditing = Boolean(editingId);
    const body = {
      contactName: document.getElementById("savedContactName").value,
      mobile: document.getElementById("savedContactMobile").value,
      ...(editingId ? { contactId: editingId } : {}),
    };
    try {
      await api("", { method: editingId ? "PUT" : "POST", body: JSON.stringify(body) });
      closeDialog();
      await refresh();
      message(wasEditing ? "Saved contact updated." : "Saved contact added.", true);
    } catch (error) { message(error.message || String(error), false); }
  }

  async function removeContact(id) {
    const contact = contacts.find((item) => Number(item.id) === Number(id));
    if (!contact) return;
    const approved = await confirmRemoval({
      title: `Remove ${contact.contactName}?`,
      message: "This contact will no longer be available to order users under this account.",
      confirmLabel: "Remove contact",
    });
    if (!approved) return;
    try {
      await api(`?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      await refresh();
      message("Saved contact removed.", true);
    } catch (error) { message(error.message || String(error), false); }
  }

  async function confirmRemoval(options) {
    if (window.BPSAccountDialogs?.confirm) return window.BPSAccountDialogs.confirm(options);
    return window.confirm(`${options.title}\n\n${options.message}`);
  }

  async function refresh() {
    const result = await api();
    contacts = Array.isArray(result.contacts) ? result.contacts : [];
    render();
  }

  function message(text, success) {
    const root = document.getElementById("accountMessage");
    if (!root) return;
    root.textContent = text;
    root.hidden = false;
    root.className = `portal-message ${success ? "is-success" : "is-error"}`;
  }

  function initials(value) {
    return String(value || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "BP";
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else void start();
})();
