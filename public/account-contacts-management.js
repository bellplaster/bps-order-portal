(() => {
  if (window.__bpsAccountContactsManagementStarted) return;
  window.__bpsAccountContactsManagementStarted = true;

  const API = "/api/account-contacts";
  let contacts = [];
  let editingContactId = null;

  async function request(options = {}) {
    const response = await fetch(API, {
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
      const result = await request();
      if (result.canManage !== true) return;
      contacts = Array.isArray(result.contacts) ? result.contacts : [];
      installStyles();
      installSection();
      installDialog();
      render();
    } catch (error) {
      showMessage(error.message || String(error), "error");
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
        <div><h2>Saved contacts</h2><p>Shared with every order user under this customer account.</p></div>
        <button id="addSavedContact" class="saved-contact-add" type="button">Add contact</button>
      </header>
      <div class="saved-contacts-table" role="table" aria-label="Saved contacts">
        <div class="saved-contacts-header" role="row">
          <span role="columnheader">Contact</span>
          <span role="columnheader">Phone</span>
          <span role="columnheader">Actions</span>
        </div>
        <div id="savedContactsList" class="saved-contacts-list"></div>
      </div>
    `;
    accountForm.insertAdjacentElement("afterend", section);
    section.querySelector("#addSavedContact")?.addEventListener("click", () => openDialog());
  }

  function installDialog() {
    if (document.getElementById("savedContactDialog")) return;
    const dialog = document.createElement("dialog");
    dialog.id = "savedContactDialog";
    dialog.className = "saved-contact-dialog";
    dialog.innerHTML = `
      <form id="savedContactForm" class="saved-contact-dialog-card">
        <header>
          <div><h2 id="savedContactDialogTitle">Add saved contact</h2><p>Available to all order users under this account.</p></div>
          <button class="saved-contact-dialog-close" type="button" aria-label="Close">×</button>
        </header>
        <div class="saved-contact-fields">
          <label><span>Contact name</span><input id="savedContactName" maxlength="100" autocomplete="name" required></label>
          <label><span>Phone</span><input id="savedContactMobile" type="tel" maxlength="16" inputmode="tel" autocomplete="tel"></label>
        </div>
        <footer>
          <button class="button button-secondary saved-contact-cancel" type="button">Cancel</button>
          <button class="button button-primary" type="submit">Save contact</button>
        </footer>
      </form>
    `;
    document.body.append(dialog);
    dialog.querySelector(".saved-contact-dialog-close")?.addEventListener("click", closeDialog);
    dialog.querySelector(".saved-contact-cancel")?.addEventListener("click", closeDialog);
    dialog.querySelector("#savedContactForm")?.addEventListener("submit", saveContact);
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeDialog();
    });
  }

  function render() {
    const list = document.getElementById("savedContactsList");
    if (!list) return;
    if (!contacts.length) {
      list.innerHTML = '<div class="saved-contacts-empty">No saved contacts yet. Add the people your team regularly orders for.</div>';
      return;
    }

    list.innerHTML = contacts.map((contact) => `
      <div class="saved-contact-row" role="row" data-contact-id="${Number(contact.id)}">
        <strong role="cell">${escapeHtml(contact.contactName)}</strong>
        <span role="cell">${escapeHtml(contact.mobile || "—")}</span>
        <div class="saved-contact-actions" role="cell">
          <button type="button" data-edit-contact="${Number(contact.id)}">Edit</button>
          <button type="button" class="is-danger" data-remove-contact="${Number(contact.id)}">Remove</button>
        </div>
      </div>
    `).join("");

    list.querySelectorAll("[data-edit-contact]").forEach((button) => {
      button.addEventListener("click", () => openDialog(Number(button.dataset.editContact)));
    });
    list.querySelectorAll("[data-remove-contact]").forEach((button) => {
      button.addEventListener("click", () => removeContact(Number(button.dataset.removeContact)));
    });
  }

  function openDialog(contactId = null) {
    const dialog = document.getElementById("savedContactDialog");
    if (!dialog) return;
    const contact = contacts.find((item) => Number(item.id) === Number(contactId));
    editingContactId = contact ? Number(contact.id) : null;
    document.getElementById("savedContactDialogTitle").textContent = contact ? "Edit saved contact" : "Add saved contact";
    document.getElementById("savedContactName").value = contact?.contactName || "";
    document.getElementById("savedContactMobile").value = contact?.mobile || "";
    typeof dialog.showModal === "function" ? dialog.showModal() : dialog.setAttribute("open", "");
    window.setTimeout(() => document.getElementById("savedContactName")?.focus(), 0);
  }

  function closeDialog() {
    const dialog = document.getElementById("savedContactDialog");
    if (dialog?.open && typeof dialog.close === "function") dialog.close();
    else dialog?.removeAttribute("open");
    editingContactId = null;
  }

  async function saveContact(event) {
    event.preventDefault();
    const contactName = document.getElementById("savedContactName")?.value || "";
    const mobile = document.getElementById("savedContactMobile")?.value || "";
    const body = { contactName, mobile };
    if (editingContactId) body.contactId = editingContactId;

    try {
      await request({
        method: editingContactId ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      closeDialog();
      await refreshContacts();
      showMessage(editingContactId ? "Saved contact updated." : "Saved contact added.", "success");
    } catch (error) {
      showMessage(error.message || String(error), "error");
    }
  }

  async function removeContact(contactId) {
    const contact = contacts.find((item) => Number(item.id) === Number(contactId));
    if (!contact) return;
    if (!window.confirm(`Remove ${contact.contactName} from the shared saved contacts?`)) return;

    try {
      await request({ method: "DELETE", headers: {}, body: undefined, cache: "no-store", redirect: "follow", referrerPolicy: "same-origin", signal: undefined, keepalive: false, mode: "same-origin", credentials: "same-origin", url: undefined });
    } catch (_ignored) {
      // DELETE needs the contact id in the URL; handled below.
    }

    try {
      const response = await fetch(`${API}?id=${encodeURIComponent(contactId)}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) throw new Error(payload.error || "Could not remove saved contact.");
      await refreshContacts();
      showMessage("Saved contact removed.", "success");
    } catch (error) {
      showMessage(error.message || String(error), "error");
    }
  }

  async function refreshContacts() {
    const result = await request();
    contacts = Array.isArray(result.contacts) ? result.contacts : [];
    render();
  }

  function showMessage(message, type) {
    const root = document.getElementById("accountMessage");
    if (!root) return;
    root.textContent = message;
    root.hidden = false;
    root.className = `portal-message ${type === "success" ? "is-success" : "is-error"}`;
    root.scrollIntoView({ block: "nearest" });
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[character]);
  }

  function installStyles() {
    if (document.getElementById("saved-contacts-management-styles")) return;
    const style = document.createElement("style");
    style.id = "saved-contacts-management-styles";
    style.textContent = `
      .saved-contacts-section{margin-top:12px!important}
      .saved-contacts-bar{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:16px!important;padding-right:10px!important}
      .saved-contacts-bar>div{display:flex!important;align-items:baseline!important;gap:10px!important;min-width:0!important}
      .saved-contacts-bar h2{margin:0!important}
      .saved-contacts-bar p{margin:0!important;color:rgba(255,255,255,.76)!important;font-size:9px!important;font-weight:400!important}
      .saved-contact-add{min-height:28px!important;margin:0!important;padding:0 10px!important;border:1px solid rgba(255,255,255,.55)!important;border-radius:3px!important;background:transparent!important;color:#fff!important;cursor:pointer!important;font:600 10px/1 Inter,system-ui,sans-serif!important}
      .saved-contact-add:hover,.saved-contact-add:focus-visible{outline:0!important;background:rgba(255,255,255,.12)!important}
      .saved-contacts-table{border:1px solid #d5dcda!important;border-top:0!important;background:#fff!important}
      .saved-contacts-header,.saved-contact-row{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(150px,.55fr) 140px!important;align-items:center!important;min-height:38px!important}
      .saved-contacts-header{background:#eef1f0!important;color:#17211f!important;font-size:9px!important;font-weight:700!important;text-transform:uppercase!important}
      .saved-contacts-header>span,.saved-contact-row>*{padding:0 10px!important;box-sizing:border-box!important}
      .saved-contact-row{border-top:1px solid #e1e6e4!important;color:#17211f!important;font-size:11px!important}
      .saved-contact-row strong{font-weight:600!important}
      .saved-contact-row>span{color:#5f6b68!important;font-variant-numeric:tabular-nums!important}
      .saved-contact-actions{display:flex!important;justify-content:flex-end!important;gap:12px!important}
      .saved-contact-actions button{margin:0!important;padding:0!important;border:0!important;background:transparent!important;color:var(--bell-green,#006557)!important;cursor:pointer!important;font:600 10px/1 Inter,system-ui,sans-serif!important}
      .saved-contact-actions button.is-danger{color:#a62b45!important}
      .saved-contacts-empty{padding:18px!important;color:#687471!important;font-size:11px!important;text-align:center!important}
      .saved-contact-dialog{width:min(440px,calc(100vw - 32px))!important;margin:auto!important;padding:0!important;border:0!important;border-radius:10px!important;background:#fff!important;box-shadow:0 24px 60px rgba(23,33,31,.24)!important}
      .saved-contact-dialog::backdrop{background:rgba(20,29,27,.38)!important;backdrop-filter:blur(2px)!important}
      .saved-contact-dialog-card{margin:0!important}
      .saved-contact-dialog-card header{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:16px!important;padding:18px 18px 14px!important;border-bottom:1px solid #e1e6e4!important}
      .saved-contact-dialog-card h2{margin:0 0 4px!important;font-size:18px!important;line-height:1.2!important}
      .saved-contact-dialog-card p{margin:0!important;color:#687471!important;font-size:10px!important}
      .saved-contact-dialog-close{width:30px!important;height:30px!important;margin:-4px -4px 0 0!important;padding:0!important;border:0!important;border-radius:50%!important;background:transparent!important;color:#17211f!important;cursor:pointer!important;font-size:20px!important}
      .saved-contact-dialog-close:hover{background:#f0f3f2!important}
      .saved-contact-fields{display:grid!important;grid-template-columns:1fr 1fr!important;gap:12px!important;padding:18px!important}
      .saved-contact-fields label{display:grid!important;gap:6px!important;color:#17211f!important;font-size:10px!important;font-weight:600!important}
      .saved-contact-fields input{width:100%!important;height:38px!important;padding:0 10px!important;border:1px solid #cfd7d4!important;border-radius:4px!important;background:#fff!important;color:#17211f!important;font:400 11px/1 Inter,system-ui,sans-serif!important;box-sizing:border-box!important}
      .saved-contact-fields input:focus{outline:0!important;border-color:var(--bell-green,#006557)!important;box-shadow:0 0 0 2px rgba(0,101,87,.1)!important}
      .saved-contact-dialog-card footer{display:flex!important;justify-content:flex-end!important;gap:8px!important;padding:14px 18px 18px!important}
      @media(max-width:680px){.saved-contacts-bar>div{display:block!important}.saved-contacts-bar p{margin-top:3px!important}.saved-contacts-header,.saved-contact-row{grid-template-columns:minmax(0,1fr) 110px}.saved-contacts-header span:nth-child(2),.saved-contact-row>span{display:none!important}.saved-contact-actions{grid-column:2!important;grid-row:1!important}.saved-contact-fields{grid-template-columns:1fr!important}}
    `;
    document.head.append(style);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else void start();
})();