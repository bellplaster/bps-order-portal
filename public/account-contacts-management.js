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
      installStyles();
      installSection();
      installDialog();
      render();
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
        <div><h2>Saved contacts</h2><p>Shared with every order user under this customer account.</p></div>
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
      <div class="saved-contact-row" role="row">
        <strong>${escapeHtml(contact.contactName)}</strong>
        <span>${escapeHtml(contact.mobile || "—")}</span>
        <div class="saved-contact-actions"><button type="button" data-edit="${Number(contact.id)}">Edit</button><button type="button" class="danger" data-remove="${Number(contact.id)}">Remove</button></div>
      </div>`).join("");
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
    if (!contact || !window.confirm(`Remove ${contact.contactName} from the shared saved contacts?`)) return;
    try {
      await api(`?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      await refresh();
      message("Saved contact removed.", true);
    } catch (error) { message(error.message || String(error), false); }
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
    root.scrollIntoView({ block: "nearest" });
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function installStyles() {
    if (document.getElementById("saved-contacts-management-styles")) return;
    const style = document.createElement("style");
    style.id = "saved-contacts-management-styles";
    style.textContent = `
      .saved-contacts-section{margin-top:12px!important}.saved-contacts-bar{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:16px!important;padding-right:10px!important}.saved-contacts-bar>div{display:flex!important;align-items:baseline!important;gap:10px!important;min-width:0!important}.saved-contacts-bar h2,.saved-contacts-bar p{margin:0!important}.saved-contacts-bar p{color:rgba(255,255,255,.76)!important;font-size:9px!important;font-weight:400!important}.saved-contacts-bar button{min-height:28px!important;padding:0 10px!important;border:1px solid rgba(255,255,255,.55)!important;border-radius:3px!important;background:transparent!important;color:#fff!important;cursor:pointer!important;font:600 10px/1 Inter,system-ui,sans-serif!important}.saved-contacts-bar button:hover{background:rgba(255,255,255,.12)!important}
      .saved-contacts-table{border:1px solid #d5dcda!important;border-top:0!important;background:#fff!important}.saved-contacts-header,.saved-contact-row{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(150px,.55fr) 140px!important;align-items:center!important;min-height:38px!important}.saved-contacts-header{background:#eef1f0!important;font-size:9px!important;font-weight:700!important;text-transform:uppercase!important}.saved-contacts-header>span,.saved-contact-row>*{padding:0 10px!important;box-sizing:border-box!important}.saved-contact-row{border-top:1px solid #e1e6e4!important;font-size:11px!important}.saved-contact-row strong{font-weight:600!important}.saved-contact-row>span{color:#5f6b68!important;font-variant-numeric:tabular-nums!important}.saved-contact-actions{display:flex!important;justify-content:flex-end!important;gap:12px!important}.saved-contact-actions button{padding:0!important;border:0!important;background:transparent!important;color:var(--bell-green,#006557)!important;cursor:pointer!important;font:600 10px/1 Inter,system-ui,sans-serif!important}.saved-contact-actions .danger{color:#a62b45!important}.saved-contacts-empty{padding:18px!important;color:#687471!important;font-size:11px!important;text-align:center!important}
      .saved-contact-dialog{width:min(440px,calc(100vw - 32px))!important;margin:auto!important;padding:0!important;border:0!important;border-radius:10px!important;background:#fff!important;box-shadow:0 24px 60px rgba(23,33,31,.24)!important}.saved-contact-dialog::backdrop{background:rgba(20,29,27,.38)!important;backdrop-filter:blur(2px)!important}.saved-contact-dialog-card{margin:0!important}.saved-contact-dialog-card header{display:flex!important;justify-content:space-between!important;gap:16px!important;padding:18px 18px 14px!important;border-bottom:1px solid #e1e6e4!important}.saved-contact-dialog-card h2{margin:0 0 4px!important;font-size:18px!important}.saved-contact-dialog-card p{margin:0!important;color:#687471!important;font-size:10px!important}.saved-contact-dialog-card header button{width:30px!important;height:30px!important;margin:-4px -4px 0 0!important;padding:0!important;border:0!important;border-radius:50%!important;background:transparent!important;font-size:20px!important;cursor:pointer!important}.saved-contact-fields{display:grid!important;grid-template-columns:1fr 1fr!important;gap:12px!important;padding:18px!important}.saved-contact-fields label{display:grid!important;gap:6px!important;font-size:10px!important;font-weight:600!important}.saved-contact-fields input{width:100%!important;height:38px!important;padding:0 10px!important;border:1px solid #cfd7d4!important;border-radius:4px!important;box-sizing:border-box!important;font:400 11px/1 Inter,system-ui,sans-serif!important}.saved-contact-fields input:focus{outline:0!important;border-color:var(--bell-green,#006557)!important;box-shadow:0 0 0 2px rgba(0,101,87,.1)!important}.saved-contact-dialog-card footer{display:flex!important;justify-content:flex-end!important;gap:8px!important;padding:14px 18px 18px!important}
      @media(max-width:680px){.saved-contacts-bar>div{display:block!important}.saved-contacts-header,.saved-contact-row{grid-template-columns:minmax(0,1fr) 110px}.saved-contacts-header span:nth-child(2),.saved-contact-row>span{display:none!important}.saved-contact-actions{grid-column:2!important;grid-row:1!important}.saved-contact-fields{grid-template-columns:1fr!important}}
    `;
    document.head.append(style);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else void start();
})();