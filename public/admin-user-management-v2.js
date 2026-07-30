(() => {
  let model = { accounts: [], users: [] };
  let query = "";
  let openGroups = new Set();
  let editingUser = null;

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  async function request(options = {}) {
    const response = await fetch("/api/admin-users", {
      ...options,
      headers: { Accept: "application/json", "Content-Type": "application/json", ...(options.headers || {}) },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.error || "Request failed.");
    return payload;
  }

  async function load() {
    model = await request();
    render();
  }

  function groupedData() {
    const groups = [];
    const admins = model.users.filter((user) => user.role === "admin");
    if (admins.length) groups.push({ id: "admins", name: "Bell Plaster administrators", debtor: "STAFF", users: admins });
    model.accounts.forEach((account) => {
      groups.push({
        id: String(account.id),
        name: account.company_name,
        debtor: account.debtor_code,
        users: model.users.filter((user) => Number(user.account_id) === Number(account.id)),
      });
    });
    if (!query) return groups;
    return groups.filter((group) => {
      const groupMatch = `${group.name} ${group.debtor}`.toLowerCase().includes(query);
      const matchedUsers = group.users.filter((user) => `${user.username} ${user.default_contact_name || ""} ${user.default_mobile || ""}`.toLowerCase().includes(query));
      if (groupMatch) return true;
      if (matchedUsers.length) {
        group.users = matchedUsers;
        openGroups.add(group.id);
        return true;
      }
      return false;
    });
  }

  function render() {
    const list = document.getElementById("usersList");
    if (!list) return;
    const groups = groupedData();
    document.getElementById("usersCount").textContent = `${model.users.length} users`;
    list.className = "admin-user-groups-v2";
    list.innerHTML = groups.length ? groups.map(groupHtml).join("") : '<div class="admin-empty">No portal users match this search.</div>';
    const pagination = document.getElementById("usersPagination");
    if (pagination) pagination.replaceChildren();
  }

  function groupHtml(group) {
    const expanded = openGroups.has(group.id) || Boolean(query);
    const primary = group.users.find((user) => Number(user.is_primary) === 1);
    return `<section class="user-account-group ${expanded ? "is-open" : ""}" data-user-group="${esc(group.id)}">
      <button type="button" class="user-group-toggle" aria-expanded="${expanded}">
        <span class="user-group-chevron" aria-hidden="true">›</span>
        <span class="user-group-title"><strong>${esc(group.name)}</strong><small>${esc(group.debtor)}</small></span>
        <span class="user-group-meta">${group.users.length} ${group.users.length === 1 ? "user" : "users"}${primary ? ` · Primary: ${esc(primary.username)}` : ""}</span>
      </button>
      <div class="user-group-body" ${expanded ? "" : "hidden"}>
        ${group.users.length ? group.users.map(userHtml).join("") : '<div class="admin-empty compact">No portal users linked to this account.</div>'}
      </div>
    </section>`;
  }

  function userHtml(user) {
    const primary = Number(user.is_primary) === 1;
    const contact = [user.default_contact_name, user.default_mobile].filter(Boolean).join(" · ") || "No saved contact";
    return `<div class="user-management-row" data-managed-user="${user.id}">
      <div class="user-identity"><div><strong>${esc(user.username)}</strong>${primary ? '<span class="primary-badge">Primary</span>' : ""}</div><small>${esc(contact)}</small></div>
      <div class="user-account-name">${esc(user.company_name || "Bell Plaster")}</div>
      <div class="user-status"><span class="status-badge ${Number(user.active) === 1 ? "is-active" : "is-inactive"}">${Number(user.active) === 1 ? "Active" : "Inactive"}</span></div>
      <div class="user-actions-v2">
        <button type="button" class="manage-user-button">Edit</button>
      </div>
    </div>`;
  }

  function ensureDialog() {
    if (document.getElementById("managePortalUserDialog")) return;
    const dialog = document.createElement("dialog");
    dialog.id = "managePortalUserDialog";
    dialog.className = "admin-dialog";
    dialog.innerHTML = `<form id="managePortalUserForm" class="admin-dialog-card">
      <header><div><h2>Edit portal user</h2><p id="managePortalUserMeta"></p></div><button class="admin-dialog-close" type="button" data-close-user-dialog aria-label="Close">×</button></header>
      <div class="admin-dialog-fields user-edit-grid">
        <label class="account-field"><span>Username</span><input id="manageUsername" required maxlength="80" autocomplete="off"></label>
        <label class="account-field"><span>Customer account</span><select id="manageAccount"></select></label>
        <label class="account-field"><span>Contact name</span><input id="manageContactName" maxlength="100"></label>
        <label class="account-field"><span>Phone</span><input id="manageMobile" type="tel" maxlength="16"></label>
        <label class="account-field"><span>Status</span><select id="manageActive"><option value="1">Active</option><option value="0">Inactive</option></select></label>
        <label class="account-field"><span>Account role</span><select id="managePrimary"><option value="0">Standard user</option><option value="1">Primary user</option></select></label>
        <label class="account-field account-field-wide"><span>New password</span><input id="managePassword" type="password" minlength="8" autocomplete="new-password" placeholder="Leave blank to keep current password"></label>
      </div>
      <footer class="user-dialog-footer"><button id="deleteManagedUser" class="button button-danger" type="button">Delete user</button><span></span><button class="button button-secondary" type="button" data-close-user-dialog>Cancel</button><button class="button button-primary" type="submit">Save user</button></footer>
    </form>`;
    document.body.append(dialog);
    dialog.querySelectorAll("[data-close-user-dialog]").forEach((button) => button.addEventListener("click", closeDialog));
    dialog.querySelector("#managePortalUserForm").addEventListener("submit", saveUser);
    dialog.querySelector("#deleteManagedUser").addEventListener("click", deleteUser);
  }

  function openEditor(user) {
    ensureDialog();
    editingUser = user;
    document.getElementById("managePortalUserMeta").textContent = user.role === "admin" ? "Administrator account" : `${user.company_name || "Customer"} · ${user.debtor_code || ""}`;
    document.getElementById("manageUsername").value = user.username || "";
    document.getElementById("manageContactName").value = user.default_contact_name || "";
    document.getElementById("manageMobile").value = user.default_mobile || "";
    document.getElementById("manageActive").value = Number(user.active) === 1 ? "1" : "0";
    document.getElementById("managePrimary").value = Number(user.is_primary) === 1 ? "1" : "0";
    document.getElementById("managePassword").value = "";
    const account = document.getElementById("manageAccount");
    account.replaceChildren(new Option("Choose customer account", ""));
    model.accounts.forEach((item) => account.append(new Option(`${item.company_name} — ${item.debtor_code}`, item.id)));
    account.value = user.account_id || "";
    const admin = user.role === "admin";
    account.disabled = admin;
    document.getElementById("managePrimary").disabled = admin;
    document.getElementById("deleteManagedUser").hidden = Number(user.id) === Number(window.__currentAdminUserId || -1);
    const dialog = document.getElementById("managePortalUserDialog");
    dialog.showModal();
    setTimeout(() => document.getElementById("manageUsername").focus(), 0);
  }

  function closeDialog() {
    const dialog = document.getElementById("managePortalUserDialog");
    if (dialog?.open) dialog.close();
    editingUser = null;
  }

  async function saveUser(event) {
    event.preventDefault();
    if (!editingUser) return;
    const payload = {
      action: "update",
      userId: editingUser.id,
      username: document.getElementById("manageUsername").value,
      accountId: document.getElementById("manageAccount").value,
      contactName: document.getElementById("manageContactName").value,
      mobile: document.getElementById("manageMobile").value,
      active: document.getElementById("manageActive").value === "1",
      primary: document.getElementById("managePrimary").value === "1",
      newPassword: document.getElementById("managePassword").value,
    };
    try {
      await request({ method: "POST", body: JSON.stringify(payload) });
      closeDialog();
      await load();
      show("Portal user updated.", "success");
    } catch (error) { show(error.message, "error"); }
  }

  async function deleteUser() {
    if (!editingUser || !confirm(`Permanently delete ${editingUser.username}?`)) return;
    try {
      await request({ method: "POST", body: JSON.stringify({ action: "delete", userId: editingUser.id }) });
      closeDialog();
      await load();
      show("Portal user deleted.", "success");
    } catch (error) { show(error.message, "error"); }
  }

  function show(message, type) {
    const box = document.getElementById("accountMessage");
    if (!box) return;
    box.textContent = message;
    box.className = `portal-message is-${type}`;
    box.hidden = false;
  }

  function installStyles() {
    if (document.getElementById("admin-user-management-v2-styles")) return;
    const style = document.createElement("style");
    style.id = "admin-user-management-v2-styles";
    style.textContent = `
      .admin-user-groups-v2{border-top:1px solid #d8dfdd}.user-account-group{border-bottom:1px solid #d8dfdd;background:#fff}
      .user-group-toggle{display:grid;grid-template-columns:18px minmax(0,1fr) auto;align-items:center;gap:10px;width:100%;padding:12px 14px;border:0;background:#f5f7f6;text-align:left;cursor:pointer}
      .user-group-chevron{font-size:22px;line-height:1;transform:rotate(0);transition:transform .15s}.user-account-group.is-open .user-group-chevron{transform:rotate(90deg)}
      .user-group-title{display:flex;flex-direction:column;gap:2px}.user-group-title small,.user-group-meta{font-size:11px;color:#687471}.user-group-meta{text-align:right}
      .user-management-row{display:grid;grid-template-columns:minmax(220px,1.5fr) minmax(140px,1fr) 110px 80px;align-items:center;min-height:54px;border-top:1px solid #e2e7e5;padding:0 14px;gap:14px}
      .user-identity>div{display:flex;align-items:center;gap:8px}.user-identity small{display:block;margin-top:3px;color:#687471}.primary-badge{font-size:9px;text-transform:uppercase;font-weight:700;color:#006557;background:#e2f3ef;padding:3px 6px;border-radius:10px}
      .user-status{text-align:center}.user-actions-v2{text-align:right}.manage-user-button{border:1px solid #cfd8d5;background:#fff;padding:7px 13px;cursor:pointer;font:inherit}.manage-user-button:hover{border-color:#006557;color:#006557}
      .user-edit-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.user-dialog-footer{display:grid!important;grid-template-columns:auto 1fr auto auto;align-items:center;gap:10px}
      .admin-empty.compact{padding:14px}.admin-table-header.admin-user-columns{display:none!important}
      @media(max-width:760px){.user-management-row{grid-template-columns:1fr auto}.user-account-name,.user-status{display:none}.user-group-meta{max-width:130px}.user-edit-grid{grid-template-columns:1fr}}
    `;
    document.head.append(style);
  }

  function initialise() {
    const list = document.getElementById("usersList");
    const search = document.getElementById("userSearch");
    if (!list || !search) return setTimeout(initialise, 100);
    installStyles();
    const replacement = search.cloneNode(true);
    search.replaceWith(replacement);
    replacement.addEventListener("input", () => { query = replacement.value.trim().toLowerCase(); render(); });
    document.getElementById("adminSection")?.addEventListener("click", (event) => {
      const toggle = event.target.closest(".user-group-toggle");
      if (toggle) {
        const group = toggle.closest("[data-user-group]");
        const id = group.dataset.userGroup;
        openGroups.has(id) ? openGroups.delete(id) : openGroups.add(id);
        render();
        return;
      }
      const edit = event.target.closest(".manage-user-button");
      if (edit) {
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
        const row = edit.closest("[data-managed-user]");
        const user = model.users.find((item) => Number(item.id) === Number(row.dataset.managedUser));
        if (user) openEditor(user);
      }
    }, true);
    void load().catch((error) => show(error.message, "error"));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialise, { once: true });
  else initialise();
})();