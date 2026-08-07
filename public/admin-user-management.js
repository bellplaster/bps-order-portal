(() => {
  const GROUP_PAGE_SIZE = 20;
  const ROLE_ADMIN = "admin";
  const ROLE_CUSTOMER = "customer";
  const ROLE_CUSTOMER_SERVICE = "customer_service";

  let model = { accounts: [], users: [], currentUserId: null };
  let query = "";
  let groupPage = 1;
  let openGroups = new Set();
  let editingUser = null;
  let loading = false;

  async function request(options = {}) {
    const response = await fetch("/api/admin-users", {
      credentials: "same-origin",
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    if (response.status === 401) {
      window.location.replace("/signin/");
      throw new Error("Authentication required.");
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.error || "Request failed.");
    return payload;
  }

  async function refresh() {
    if (loading) return;
    loading = true;
    try {
      const result = await request();
      model = {
        accounts: Array.isArray(result.accounts) ? result.accounts : [],
        users: Array.isArray(result.users) ? result.users : [],
        currentUserId: Number(result.currentUserId || 0) || null,
      };
      render();
    } catch (error) {
      showMessage(error.message || String(error), "error");
    } finally {
      loading = false;
    }
  }

  function isInternalRole(role) {
    return role === ROLE_ADMIN || role === ROLE_CUSTOMER_SERVICE;
  }

  function roleLabel(role, primary = false) {
    if (role === ROLE_ADMIN) return "Administrator";
    if (role === ROLE_CUSTOMER_SERVICE) return "Customer Service";
    return primary ? "Primary user" : "Standard user";
  }

  function allGroups() {
    const groups = [];
    const administrators = model.users.filter((user) => user.role === ROLE_ADMIN);
    const customerServiceUsers = model.users.filter((user) => user.role === ROLE_CUSTOMER_SERVICE);

    if (administrators.length) {
      groups.push({
        id: "internal-staff",
        accountId: null,
        name: "Bell Plaster staff",
        debtorCode: "Internal access",
        active: true,
        internal: true,
        users: administrators,
        emptyLabel: "No administrator users.",
      });
    }

    groups.push({
      id: "customer-service",
      accountId: null,
      name: "Customer Service",
      debtorCode: "All customer accounts",
      active: true,
      internal: true,
      users: customerServiceUsers,
      emptyLabel: "No Customer Service users yet.",
    });

    model.accounts.forEach((account) => {
      groups.push({
        id: `account-${account.id}`,
        accountId: Number(account.id),
        name: String(account.company_name || "Unnamed customer"),
        debtorCode: String(account.debtor_code || ""),
        active: Number(account.active) === 1,
        internal: false,
        users: model.users.filter((user) => user.role === ROLE_CUSTOMER && Number(user.account_id) === Number(account.id)),
        emptyLabel: "No portal users linked to this customer.",
      });
    });
    return groups;
  }

  function filteredGroups() {
    if (!query) return allGroups();
    return allGroups().reduce((matches, group) => {
      const groupMatches = `${group.name} ${group.debtorCode}`.toLowerCase().includes(query);
      const users = group.users.filter((user) => [
        user.username,
        user.default_contact_name,
        user.default_mobile,
        user.company_name,
        user.debtor_code,
        roleLabel(user.role, Number(user.is_primary) === 1),
      ].join(" ").toLowerCase().includes(query));
      if (groupMatches || users.length) {
        matches.push({ ...group, users: groupMatches ? group.users : users });
        openGroups.add(group.id);
      }
      return matches;
    }, []);
  }

  function render() {
    const list = document.getElementById("usersList");
    if (!list) return;
    const groups = filteredGroups();
    const totalPages = Math.max(1, Math.ceil(groups.length / GROUP_PAGE_SIZE));
    groupPage = Math.min(Math.max(1, groupPage), totalPages);
    const visible = query ? groups : groups.slice((groupPage - 1) * GROUP_PAGE_SIZE, groupPage * GROUP_PAGE_SIZE);
    const count = document.getElementById("usersCount");
    if (count) count.textContent = `${model.users.length} ${model.users.length === 1 ? "user" : "users"} across ${model.accounts.length} ${model.accounts.length === 1 ? "customer" : "customers"}`;
    list.className = "admin-user-groups";
    list.innerHTML = visible.length ? visible.map(groupTemplate).join("") : '<div class="admin-empty">No portal users or customer accounts match this search.</div>';
    renderPagination(groups.length, totalPages);
  }

  function groupTemplate(group) {
    const expanded = openGroups.has(group.id) || Boolean(query);
    const primary = group.users.find((user) => Number(user.is_primary) === 1);
    const primaryText = primary ? ` · Primary: ${primary.username}` : "";
    const inactiveText = !group.internal && !group.active ? " · Inactive customer" : "";
    return `<section class="portal-user-group ${expanded ? "is-open" : ""}" data-user-group="${escapeHtml(group.id)}">
      <button type="button" class="portal-user-group-toggle" aria-expanded="${expanded}">
        <span class="portal-user-group-chevron" aria-hidden="true">›</span>
        <span class="portal-user-group-title"><strong>${escapeHtml(group.name)}</strong><small>${escapeHtml(group.debtorCode)}</small></span>
        <span class="portal-user-group-meta">${group.users.length} ${group.users.length === 1 ? "user" : "users"}${escapeHtml(primaryText)}${escapeHtml(inactiveText)}</span>
      </button>
      <div class="portal-user-group-body" ${expanded ? "" : "hidden"}>
        ${group.users.length ? group.users.map(userTemplate).join("") : `<div class="admin-empty compact">${escapeHtml(group.emptyLabel || "No portal users.")}</div>`}
      </div>
    </section>`;
  }

  function userTemplate(user) {
    const primary = Number(user.is_primary) === 1;
    const active = Number(user.active) === 1;
    const contact = [user.default_contact_name, user.default_mobile].filter(Boolean).join(" · ") || "No saved contact";
    return `<div class="portal-user-row" data-managed-user="${Number(user.id)}">
      <div class="portal-user-identity"><div><strong>${escapeHtml(user.username)}</strong>${primary ? '<span class="portal-primary-badge">Primary</span>' : ""}</div><small>${escapeHtml(contact)}</small></div>
      <div class="portal-user-role">${escapeHtml(roleLabel(user.role, primary))}</div>
      <div class="portal-user-status"><span class="status-badge ${active ? "is-active" : "is-inactive"}">${active ? "Active" : "Inactive"}</span></div>
      <div class="portal-user-actions"><button type="button" class="portal-user-edit">Edit</button></div>
    </div>`;
  }

  function renderPagination(totalGroups, totalPages) {
    const root = document.getElementById("usersPagination");
    if (!root) return;
    root.replaceChildren();
    if (query || totalPages <= 1) return;
    root.innerHTML = `<span>Groups ${(groupPage - 1) * GROUP_PAGE_SIZE + 1}–${Math.min(groupPage * GROUP_PAGE_SIZE, totalGroups)} of ${totalGroups}</span><div><button type="button" data-user-group-page="${groupPage - 1}" ${groupPage <= 1 ? "disabled" : ""}>Previous</button><button type="button" data-user-group-page="${groupPage + 1}" ${groupPage >= totalPages ? "disabled" : ""}>Next</button></div>`;
  }

  function ensureDialog() {
    if (document.getElementById("managePortalUserDialog")) return;
    const dialog = document.createElement("dialog");
    dialog.id = "managePortalUserDialog";
    dialog.className = "admin-dialog portal-user-dialog";
    dialog.innerHTML = `<form id="managePortalUserForm" class="admin-dialog-card">
      <header><div><h2>Edit portal user</h2><p id="managePortalUserMeta"></p></div><button class="admin-dialog-close" type="button" data-close-user-dialog aria-label="Close">×</button></header>
      <div class="admin-dialog-fields portal-user-edit-grid">
        <label class="account-field"><span>Login username</span><input id="manageUsername" required maxlength="80" autocomplete="off"></label>
        <label class="account-field"><span>Access role</span><select id="manageRole"><option value="customer">Customer</option><option value="customer_service">Customer Service</option><option value="admin">Administrator</option></select></label>
        <label class="account-field"><span>Customer account</span><select id="manageAccount"></select></label>
        <label class="account-field"><span>Contact name</span><input id="manageContactName" maxlength="100" autocomplete="name"></label>
        <label class="account-field"><span>Phone</span><input id="manageMobile" type="tel" maxlength="16" inputmode="tel" autocomplete="tel"></label>
        <label class="account-field"><span>Status</span><select id="manageActive"><option value="1">Active</option><option value="0">Inactive</option></select></label>
        <label class="account-field"><span>Customer account role</span><select id="managePrimary"><option value="0">Standard user</option><option value="1">Primary user</option></select></label>
        <label class="account-field account-field-wide"><span>New password</span><input id="managePassword" type="password" minlength="8" autocomplete="new-password" placeholder="Leave blank to keep current password"></label>
      </div>
      <p id="managePortalUserNote" class="portal-user-dialog-note"></p>
      <footer class="portal-user-dialog-footer"><button id="deleteManagedUser" class="button button-danger" type="button">Delete user</button><span></span><button class="button button-secondary" type="button" data-close-user-dialog>Cancel</button><button class="button button-primary" type="submit">Save user</button></footer>
    </form>`;
    document.body.append(dialog);
    dialog.querySelectorAll("[data-close-user-dialog]").forEach((button) => button.addEventListener("click", closeDialog));
    dialog.querySelector("form").addEventListener("submit", saveUser);
    dialog.querySelector("#deleteManagedUser").addEventListener("click", deleteUser);
    dialog.querySelector("#manageMobile").addEventListener("input", formatPhone);
    dialog.querySelector("#manageActive").addEventListener("change", syncEditorFields);
    dialog.querySelector("#manageRole").addEventListener("change", syncEditorFields);
  }

  function populateAccountSelect(select, selectedAccountId, required) {
    select.replaceChildren(new Option(required ? "Choose customer account" : "No customer account required", ""));
    model.accounts.forEach((account) => {
      const suffix = Number(account.active) === 1 ? "" : " (inactive)";
      select.append(new Option(`${account.company_name} — ${account.debtor_code}${suffix}`, String(account.id)));
    });
    select.value = selectedAccountId == null ? "" : String(selectedAccountId);
  }

  function openEditor(user) {
    ensureDialog();
    editingUser = user;
    document.getElementById("managePortalUserMeta").textContent = isInternalRole(user.role)
      ? roleLabel(user.role)
      : `${user.company_name || "Customer"} · ${user.debtor_code || ""}`;
    document.getElementById("manageUsername").value = user.username || "";
    document.getElementById("manageRole").value = user.role || ROLE_CUSTOMER;
    document.getElementById("manageContactName").value = user.default_contact_name || "";
    document.getElementById("manageMobile").value = user.default_mobile || "";
    document.getElementById("manageActive").value = Number(user.active) === 1 ? "1" : "0";
    document.getElementById("managePrimary").value = Number(user.is_primary) === 1 ? "1" : "0";
    document.getElementById("managePassword").value = "";
    populateAccountSelect(document.getElementById("manageAccount"), user.account_id, user.role === ROLE_CUSTOMER);
    document.getElementById("deleteManagedUser").hidden = Number(user.id) === Number(model.currentUserId);
    syncEditorFields();
    const dialog = document.getElementById("managePortalUserDialog");
    typeof dialog.showModal === "function" ? dialog.showModal() : dialog.setAttribute("open", "");
  }

  function closeDialog() {
    const dialog = document.getElementById("managePortalUserDialog");
    if (dialog?.open && typeof dialog.close === "function") dialog.close(); else dialog?.removeAttribute("open");
    editingUser = null;
  }

  function syncEditorFields() {
    if (!editingUser) return;
    const role = document.getElementById("manageRole").value;
    const account = document.getElementById("manageAccount");
    const primary = document.getElementById("managePrimary");
    const active = document.getElementById("manageActive");
    const customer = role === ROLE_CUSTOMER;

    account.disabled = !customer;
    account.required = customer;
    if (!customer) account.value = "";
    primary.disabled = !customer || active.value !== "1";
    if (primary.disabled) primary.value = "0";

    const note = document.getElementById("managePortalUserNote");
    if (role === ROLE_ADMIN) {
      note.textContent = "Administrators can manage customers, users, catalogue settings and every order, including test orders.";
    } else if (role === ROLE_CUSTOMER_SERVICE) {
      note.textContent = "Customer Service users can review genuine customer orders and place orders on behalf of any active customer. Administrator test orders and administration tools remain hidden.";
    } else {
      note.textContent = "Only one primary user is allowed per customer. Assigning this user as primary replaces the current primary user.";
    }
  }

  async function saveUser(event) {
    event.preventDefault();
    if (!editingUser) return;
    try {
      await request({ method: "POST", body: JSON.stringify({
        action: "update",
        userId: editingUser.id,
        username: document.getElementById("manageUsername").value,
        role: document.getElementById("manageRole").value,
        accountId: document.getElementById("manageAccount").value,
        contactName: document.getElementById("manageContactName").value,
        mobile: document.getElementById("manageMobile").value,
        active: document.getElementById("manageActive").value === "1",
        primary: document.getElementById("managePrimary").value === "1",
        newPassword: document.getElementById("managePassword").value,
      }) });
      closeDialog();
      await refresh();
      showMessage("Portal user updated.", "success");
    } catch (error) { showMessage(error.message || String(error), "error"); }
  }

  async function deleteUser() {
    if (!editingUser) return;
    const confirmed = window.confirm(`Permanently delete ${editingUser.username}?`);
    if (!confirmed) return;
    try {
      await request({ method: "POST", body: JSON.stringify({ action: "delete", userId: editingUser.id }) });
      closeDialog();
      await refresh();
      showMessage("Portal user deleted.", "success");
    } catch (error) { showMessage(error.message || String(error), "error"); }
  }

  function enhanceCreateForm() {
    const form = document.getElementById("createUserForm");
    const grid = form?.querySelector(".admin-user-create-grid");
    if (!form || !grid || form.dataset.portalUserManaged === "true") return;
    form.dataset.portalUserManaged = "true";
    const contact = document.createElement("label");
    contact.className = "account-field";
    contact.innerHTML = '<span>Contact name</span><input id="newUserContactName" maxlength="100" autocomplete="name">';
    const phone = document.createElement("label");
    phone.className = "account-field";
    phone.innerHTML = '<span>Phone</span><input id="newUserMobile" type="tel" maxlength="16" inputmode="tel" autocomplete="tel">';
    const primary = document.createElement("label");
    primary.className = "account-field";
    primary.innerHTML = '<span>Customer account role</span><select id="newUserPrimary"><option value="0">Standard user</option><option value="1">Primary user</option></select>';
    grid.append(contact, phone, primary);
    document.getElementById("newUserMobile")?.addEventListener("input", formatPhone);
    document.getElementById("newUserRole")?.addEventListener("change", syncCreateFields);
    form.addEventListener("submit", createUser, true);
    syncCreateFields();
  }

  function syncCreateFields() {
    const role = document.getElementById("newUserRole")?.value || ROLE_CUSTOMER;
    const customer = role === ROLE_CUSTOMER;
    const account = document.getElementById("newUserAccount");
    const primary = document.getElementById("newUserPrimary");
    if (account) {
      account.disabled = !customer;
      account.required = customer;
      if (!customer) account.value = "";
      const empty = account.options[0];
      if (empty) empty.textContent = customer ? "Choose customer account" : "No customer account required";
    }
    if (primary) {
      primary.disabled = !customer;
      if (!customer) primary.value = "0";
    }
  }

  async function createUser(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const form = event.currentTarget;
    try {
      await request({ method: "POST", body: JSON.stringify({
        action: "create",
        username: document.getElementById("newUsername").value,
        role: document.getElementById("newUserRole").value,
        accountId: document.getElementById("newUserAccount").value,
        password: document.getElementById("newUserPassword").value,
        contactName: document.getElementById("newUserContactName")?.value || "",
        mobile: document.getElementById("newUserMobile")?.value || "",
        primary: document.getElementById("newUserPrimary")?.value === "1",
      }) });
      form.reset();
      form.hidden = true;
      syncCreateFields();
      await refresh();
      showMessage("Portal user created.", "success");
    } catch (error) { showMessage(error.message || String(error), "error"); }
  }

  function replaceLegacyControls() {
    const list = document.getElementById("usersList");
    if (list && list.dataset.portalUserManaged !== "true") {
      const replacement = list.cloneNode(false);
      replacement.id = "usersList";
      replacement.className = "admin-user-groups";
      replacement.dataset.portalUserManaged = "true";
      list.replaceWith(replacement);
    }
    const search = document.getElementById("userSearch");
    if (search && search.dataset.portalUserManaged !== "true") {
      const replacement = search.cloneNode(true);
      replacement.dataset.portalUserManaged = "true";
      replacement.placeholder = "Search customer, staff, user, contact or phone";
      search.replaceWith(replacement);
      replacement.addEventListener("input", () => {
        query = replacement.value.trim().toLowerCase();
        groupPage = 1;
        render();
      });
    }
  }

  function bindEvents() {
    const root = document.getElementById("adminSection");
    if (!root || root.dataset.portalUserEvents === "true") return;
    root.dataset.portalUserEvents = "true";
    root.addEventListener("click", (event) => {
      const toggle = event.target.closest(".portal-user-group-toggle");
      if (toggle) {
        const id = toggle.closest("[data-user-group]")?.dataset.userGroup;
        if (id) { openGroups.has(id) ? openGroups.delete(id) : openGroups.add(id); render(); }
        return;
      }
      const edit = event.target.closest(".portal-user-edit");
      if (edit) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        const id = Number(edit.closest("[data-managed-user]")?.dataset.managedUser || 0);
        const user = model.users.find((candidate) => Number(candidate.id) === id);
        if (user) openEditor(user);
        return;
      }
      const page = event.target.closest("[data-user-group-page]");
      if (page && !page.disabled) { groupPage = Number(page.dataset.userGroupPage || 1); render(); }
    }, true);
  }

  function installStyles() {
    if (document.getElementById("portal-user-management-styles")) return;
    const style = document.createElement("style");
    style.id = "portal-user-management-styles";
    style.textContent = `.admin-table-header.admin-user-columns{display:none!important}.admin-user-groups{border-top:1px solid #d8dfdd;background:#fff}.portal-user-group{border-bottom:1px solid #d8dfdd;background:#fff}.portal-user-group-toggle{display:grid;grid-template-columns:20px minmax(0,1fr) auto;align-items:center;gap:10px;width:100%;padding:12px 14px;border:0;border-radius:0;background:#f5f7f6;color:#17211f;text-align:left;cursor:pointer;font:inherit}.portal-user-group-chevron{font-size:22px;line-height:1;transition:transform .15s ease}.portal-user-group.is-open .portal-user-group-chevron{transform:rotate(90deg)}.portal-user-group-title{display:grid;gap:2px}.portal-user-group-title strong{font-size:12px}.portal-user-group-title small,.portal-user-group-meta{font-size:10px;color:#687471}.portal-user-row{display:grid;grid-template-columns:minmax(240px,1fr) 140px 110px 88px;align-items:center;gap:14px;min-height:56px;padding:0 14px;border-top:1px solid #e3e8e6}.portal-user-identity small{display:block;margin-top:3px;color:#687471}.portal-user-status{text-align:center}.portal-user-actions{text-align:right}.portal-primary-badge{display:inline-block;margin-left:8px;padding:2px 6px;border-radius:999px;background:#e2f3ef;color:#006557;font-size:8px;font-weight:700;text-transform:uppercase}.portal-user-edit{padding:7px 12px;border:1px solid #cfd8d5;background:#fff;cursor:pointer}.portal-user-edit-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.portal-user-dialog-footer{display:grid!important;grid-template-columns:auto 1fr auto auto;gap:10px}.portal-user-dialog-note{margin:0;padding:0 18px 14px;color:#687471;font-size:11px}#createUserForm .admin-user-create-grid{grid-template-columns:repeat(3,minmax(0,1fr))}@media(max-width:700px){.portal-user-row{grid-template-columns:1fr auto}.portal-user-role,.portal-user-status{display:none}.portal-user-edit-grid,#createUserForm .admin-user-create-grid{grid-template-columns:1fr}}`;
    document.head.append(style);
  }

  function formatPhone(event) {
    if (event.target instanceof HTMLInputElement && window.BPSPhone?.formatTyping) event.target.value = window.BPSPhone.formatTyping(event.target.value);
  }

  function showMessage(message, type) {
    const box = document.getElementById("accountMessage");
    if (!box) return;
    box.textContent = message;
    box.className = `portal-message is-${type}`;
    box.hidden = false;
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function initialise() {
    if (!document.body.classList.contains("account-page")) return;
    if (!document.getElementById("usersList") || !document.getElementById("userSearch")) return;
    replaceLegacyControls();
    installStyles();
    bindEvents();
    enhanceCreateForm();
    try { window.renderUsers = () => void refresh(); } catch (_error) {}
    try { renderUsers = () => void refresh(); } catch (_error) {}
    void refresh();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialise, { once: true });
  else initialise();
})();