(() => {
  const GROUP_PAGE_SIZE = 20;
  let model = { accounts: [], users: [], currentUserId: null };
  let query = "";
  let groupPage = 1;
  let openGroups = new Set();
  let editingUser = null;
  let loading = false;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);
  }

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

  function allGroups() {
    const groups = [];
    const administrators = model.users.filter((user) => user.role === "admin");
    if (administrators.length) {
      groups.push({
        id: "administrators",
        name: "Bell Plaster administrators",
        debtorCode: "STAFF",
        users: administrators,
        isAdminGroup: true,
      });
    }

    model.accounts.forEach((account) => {
      groups.push({
        id: `account-${account.id}`,
        accountId: Number(account.id),
        name: String(account.company_name || "Unnamed customer"),
        debtorCode: String(account.debtor_code || ""),
        active: Number(account.active) === 1,
        users: model.users.filter((user) => Number(user.account_id) === Number(account.id) && user.role !== "admin"),
        isAdminGroup: false,
      });
    });

    return groups;
  }

  function filteredGroups() {
    const groups = allGroups();
    if (!query) return groups;

    return groups.reduce((matches, group) => {
      const groupMatches = `${group.name} ${group.debtorCode}`.toLowerCase().includes(query);
      const matchingUsers = group.users.filter((user) => [
        user.username,
        user.default_contact_name,
        user.default_mobile,
        user.company_name,
        user.debtor_code,
      ].join(" ").toLowerCase().includes(query));

      if (groupMatches || matchingUsers.length) {
        matches.push({ ...group, users: groupMatches ? group.users : matchingUsers });
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
    const visibleGroups = query
      ? groups
      : groups.slice((groupPage - 1) * GROUP_PAGE_SIZE, groupPage * GROUP_PAGE_SIZE);

    const customerCount = model.accounts.length;
    const count = document.getElementById("usersCount");
    if (count) {
      count.textContent = `${model.users.length} ${model.users.length === 1 ? "user" : "users"} across ${customerCount} ${customerCount === 1 ? "customer" : "customers"}`;
    }

    list.className = "admin-user-groups";
    list.innerHTML = visibleGroups.length
      ? visibleGroups.map(groupTemplate).join("")
      : '<div class="admin-empty">No portal users or customer accounts match this search.</div>';

    renderGroupPagination(groups.length, totalPages);
  }

  function groupTemplate(group) {
    const expanded = openGroups.has(group.id) || Boolean(query);
    const primary = group.users.find((user) => Number(user.is_primary) === 1);
    const userCount = group.users.length;
    const primaryText = primary ? ` · Primary: ${primary.username}` : "";
    const inactiveText = group.active === false ? " · Inactive customer" : "";

    return `<section class="portal-user-group ${expanded ? "is-open" : ""}" data-user-group="${escapeHtml(group.id)}">
      <button type="button" class="portal-user-group-toggle" aria-expanded="${expanded}">
        <span class="portal-user-group-chevron" aria-hidden="true">›</span>
        <span class="portal-user-group-title"><strong>${escapeHtml(group.name)}</strong><small>${escapeHtml(group.debtorCode)}</small></span>
        <span class="portal-user-group-meta">${userCount} ${userCount === 1 ? "user" : "users"}${escapeHtml(primaryText)}${escapeHtml(inactiveText)}</span>
      </button>
      <div class="portal-user-group-body" ${expanded ? "" : "hidden"}>
        ${userCount ? group.users.map(userTemplate).join("") : '<div class="admin-empty compact">No portal users linked to this customer.</div>'}
      </div>
    </section>`;
  }

  function userTemplate(user) {
    const primary = Number(user.is_primary) === 1;
    const active = Number(user.active) === 1;
    const contact = [user.default_contact_name, user.default_mobile].filter(Boolean).join(" · ") || "No saved contact";
    const roleLabel = user.role === "admin" ? "Administrator" : (primary ? "Primary user" : "Standard user");

    return `<div class="portal-user-row" data-managed-user="${Number(user.id)}">
      <div class="portal-user-identity">
        <div><strong>${escapeHtml(user.username)}</strong>${primary ? '<span class="portal-primary-badge">Primary</span>' : ""}</div>
        <small>${escapeHtml(contact)}</small>
      </div>
      <div class="portal-user-role">${escapeHtml(roleLabel)}</div>
      <div class="portal-user-status"><span class="status-badge ${active ? "is-active" : "is-inactive"}">${active ? "Active" : "Inactive"}</span></div>
      <div class="portal-user-actions"><button type="button" class="portal-user-edit">Edit</button></div>
    </div>`;
  }

  function renderGroupPagination(totalGroups, totalPages) {
    const pagination = document.getElementById("usersPagination");
    if (!pagination) return;
    pagination.replaceChildren();
    if (query || totalPages <= 1) return;

    pagination.innerHTML = `<span>Customer groups ${(groupPage - 1) * GROUP_PAGE_SIZE + 1}–${Math.min(groupPage * GROUP_PAGE_SIZE, totalGroups)} of ${totalGroups}</span>
      <div>
        <button type="button" data-user-group-page="${groupPage - 1}" ${groupPage <= 1 ? "disabled" : ""}>Previous</button>
        <button type="button" data-user-group-page="${groupPage + 1}" ${groupPage >= totalPages ? "disabled" : ""}>Next</button>
      </div>`;
  }

  function ensureUserDialog() {
    if (document.getElementById("managePortalUserDialog")) return;
    const dialog = document.createElement("dialog");
    dialog.id = "managePortalUserDialog";
    dialog.className = "admin-dialog portal-user-dialog";
    dialog.innerHTML = `<form id="managePortalUserForm" class="admin-dialog-card">
      <header><div><h2>Edit portal user</h2><p id="managePortalUserMeta"></p></div><button class="admin-dialog-close" type="button" data-close-user-dialog aria-label="Close">×</button></header>
      <div class="admin-dialog-fields portal-user-edit-grid">
        <label class="account-field"><span>Login username</span><input id="manageUsername" required maxlength="80" autocomplete="off"></label>
        <label class="account-field"><span>Customer account</span><select id="manageAccount"></select></label>
        <label class="account-field"><span>Contact name</span><input id="manageContactName" maxlength="100" autocomplete="name"></label>
        <label class="account-field"><span>Phone</span><input id="manageMobile" type="tel" maxlength="16" inputmode="tel" autocomplete="tel"></label>
        <label class="account-field"><span>Status</span><select id="manageActive"><option value="1">Active</option><option value="0">Inactive</option></select></label>
        <label class="account-field"><span>Account role</span><select id="managePrimary"><option value="0">Standard user</option><option value="1">Primary user</option></select></label>
        <label class="account-field account-field-wide"><span>New password</span><input id="managePassword" type="password" minlength="8" autocomplete="new-password" placeholder="Leave blank to keep current password"></label>
      </div>
      <p id="managePortalUserNote" class="portal-user-dialog-note"></p>
      <footer class="portal-user-dialog-footer"><button id="deleteManagedUser" class="button button-danger" type="button">Delete user</button><span></span><button class="button button-secondary" type="button" data-close-user-dialog>Cancel</button><button class="button button-primary" type="submit">Save user</button></footer>
    </form>`;
    document.body.append(dialog);

    dialog.querySelectorAll("[data-close-user-dialog]").forEach((button) => button.addEventListener("click", closeUserDialog));
    dialog.querySelector("#managePortalUserForm").addEventListener("submit", saveUser);
    dialog.querySelector("#deleteManagedUser").addEventListener("click", deleteUser);
    dialog.querySelector("#manageMobile").addEventListener("input", formatPhoneInput);
    dialog.querySelector("#manageActive").addEventListener("change", syncPrimaryAvailability);
  }

  function populateAccountSelect(select, selectedAccountId, includeBlank = true) {
    select.replaceChildren();
    if (includeBlank) select.append(new Option("Choose customer account", ""));
    model.accounts.forEach((account) => {
      const status = Number(account.active) === 1 ? "" : " (inactive)";
      select.append(new Option(`${account.company_name} — ${account.debtor_code}${status}`, String(account.id)));
    });
    select.value = selectedAccountId == null ? "" : String(selectedAccountId);
  }

  function openUserEditor(user) {
    ensureUserDialog();
    editingUser = user;

    const admin = user.role === "admin";
    document.getElementById("managePortalUserMeta").textContent = admin
      ? "Bell Plaster administrator"
      : `${user.company_name || "Customer"} · ${user.debtor_code || ""}`;
    document.getElementById("manageUsername").value = user.username || "";
    document.getElementById("manageContactName").value = user.default_contact_name || "";
    document.getElementById("manageMobile").value = user.default_mobile || "";
    document.getElementById("manageActive").value = Number(user.active) === 1 ? "1" : "0";
    document.getElementById("managePrimary").value = Number(user.is_primary) === 1 ? "1" : "0";
    document.getElementById("managePassword").value = "";

    const accountSelect = document.getElementById("manageAccount");
    populateAccountSelect(accountSelect, user.account_id);
    accountSelect.disabled = admin;
    document.getElementById("managePrimary").disabled = admin;
    document.getElementById("deleteManagedUser").hidden = Number(user.id) === Number(model.currentUserId);
    document.getElementById("managePortalUserNote").textContent = admin
      ? "Administrator accounts are not linked to customer debtor accounts."
      : "Only one primary user is allowed per customer. Assigning this user as primary replaces the current primary user.";
    syncPrimaryAvailability();

    const dialog = document.getElementById("managePortalUserDialog");
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    window.setTimeout(() => document.getElementById("manageUsername")?.focus(), 0);
  }

  function closeUserDialog() {
    const dialog = document.getElementById("managePortalUserDialog");
    if (dialog?.open && typeof dialog.close === "function") dialog.close();
    else dialog?.removeAttribute("open");
    editingUser = null;
  }

  function syncPrimaryAvailability() {
    const primary = document.getElementById("managePrimary");
    const active = document.getElementById("manageActive");
    if (!primary || !active || !editingUser) return;
    const admin = editingUser.role === "admin";
    primary.disabled = admin || active.value !== "1";
    if (active.value !== "1") primary.value = "0";
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
      closeUserDialog();
      await refresh();
      showMessage("Portal user updated.", "success");
    } catch (error) {
      showMessage(error.message || String(error), "error");
    }
  }

  async function deleteUser() {
    if (!editingUser) return;
    const warning = Number(editingUser.is_primary) === 1
      ? `${editingUser.username} is the primary user. Deleting this login will leave the customer without a primary user.`
      : `Permanently delete ${editingUser.username}?`;
    const confirmed = typeof confirmAdmin === "function"
      ? await confirmAdmin({
          title: "Delete portal user",
          message: warning,
          confirmLabel: "Delete user",
          danger: true,
          confirmationText: editingUser.username,
        })
      : window.confirm(warning);
    if (!confirmed) return;

    try {
      await request({ method: "POST", body: JSON.stringify({ action: "delete", userId: editingUser.id }) });
      closeUserDialog();
      await refresh();
      showMessage("Portal user deleted.", "success");
    } catch (error) {
      showMessage(error.message || String(error), "error");
    }
  }

  function enhanceCreateUserForm() {
    const form = document.getElementById("createUserForm");
    const grid = form?.querySelector(".admin-user-create-grid");
    if (!form || !grid || form.dataset.portalUserManaged === "true") return;
    form.dataset.portalUserManaged = "true";

    const contactField = document.createElement("label");
    contactField.className = "account-field";
    contactField.innerHTML = '<span>Contact name</span><input id="newUserContactName" maxlength="100" autocomplete="name">';
    const phoneField = document.createElement("label");
    phoneField.className = "account-field";
    phoneField.innerHTML = '<span>Phone</span><input id="newUserMobile" type="tel" maxlength="16" inputmode="tel" autocomplete="tel">';
    const primaryField = document.createElement("label");
    primaryField.className = "account-field";
    primaryField.innerHTML = '<span>Account role</span><select id="newUserPrimary"><option value="0">Standard user</option><option value="1">Primary user</option></select>';
    grid.append(contactField, phoneField, primaryField);

    document.getElementById("newUserMobile")?.addEventListener("input", formatPhoneInput);
    document.getElementById("newUserRole")?.addEventListener("change", syncCreateUserFields);
    form.addEventListener("submit", createUser, true);
    syncCreateUserFields();
  }

  function syncCreateUserFields() {
    const role = document.getElementById("newUserRole")?.value || "customer";
    const account = document.getElementById("newUserAccount");
    const primary = document.getElementById("newUserPrimary");
    const admin = role === "admin";
    if (account) {
      account.disabled = admin;
      account.required = !admin;
      if (admin) account.value = "";
    }
    if (primary) {
      primary.disabled = admin;
      if (admin) primary.value = "0";
    }
  }

  async function createUser(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const form = event.currentTarget;
    const payload = {
      action: "create",
      username: document.getElementById("newUsername").value,
      role: document.getElementById("newUserRole").value,
      accountId: document.getElementById("newUserAccount").value,
      password: document.getElementById("newUserPassword").value,
      contactName: document.getElementById("newUserContactName")?.value || "",
      mobile: document.getElementById("newUserMobile")?.value || "",
      primary: document.getElementById("newUserPrimary")?.value === "1",
    };

    try {
      await request({ method: "POST", body: JSON.stringify(payload) });
      form.reset();
      form.hidden = true;
      document.getElementById("newUserRole").value = "customer";
      syncCreateUserFields();
      await refresh();
      showMessage("Portal user created.", "success");
    } catch (error) {
      showMessage(error.message || String(error), "error");
    }
  }

  function formatPhoneInput(event) {
    const field = event.target;
    if (!(field instanceof HTMLInputElement)) return;
    if (window.BPSPhone?.formatTyping) field.value = window.BPSPhone.formatTyping(field.value);
  }

  function showMessage(message, type) {
    const box = document.getElementById("accountMessage");
    if (!box) return;
    box.textContent = message;
    box.className = `portal-message is-${type}`;
    box.hidden = false;
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function replaceLegacyControls() {
    const currentList = document.getElementById("usersList");
    if (currentList && currentList.dataset.portalUserManaged !== "true") {
      const replacement = currentList.cloneNode(false);
      replacement.id = "usersList";
      replacement.className = "admin-user-groups";
      replacement.dataset.portalUserManaged = "true";
      currentList.replaceWith(replacement);
    }

    const currentSearch = document.getElementById("userSearch");
    if (currentSearch && currentSearch.dataset.portalUserManaged !== "true") {
      const replacement = currentSearch.cloneNode(true);
      replacement.dataset.portalUserManaged = "true";
      replacement.placeholder = "Search customer, user, contact or phone";
      currentSearch.replaceWith(replacement);
      replacement.addEventListener("input", () => {
        query = replacement.value.trim().toLowerCase();
        groupPage = 1;
        render();
      });
    }
  }

  function installStyles() {
    if (document.getElementById("portal-user-management-styles")) return;
    const style = document.createElement("style");
    style.id = "portal-user-management-styles";
    style.textContent = `
      .admin-table-header.admin-user-columns{display:none!important}
      .admin-user-groups{border-top:1px solid #d8dfdd;background:#fff}
      .portal-user-group{border-bottom:1px solid #d8dfdd;background:#fff}
      .portal-user-group-toggle{display:grid;grid-template-columns:20px minmax(0,1fr) auto;align-items:center;gap:10px;width:100%;padding:12px 14px;border:0;border-radius:0;background:#f5f7f6;color:#17211f;text-align:left;cursor:pointer;font:inherit}
      .portal-user-group-toggle:hover{background:#eef2f0}
      .portal-user-group-chevron{font-size:22px;line-height:1;transition:transform .15s ease}.portal-user-group.is-open .portal-user-group-chevron{transform:rotate(90deg)}
      .portal-user-group-title{display:grid;gap:2px;min-width:0}.portal-user-group-title strong{font-size:12px}.portal-user-group-title small,.portal-user-group-meta{font-size:10px;color:#687471}.portal-user-group-meta{text-align:right;white-space:nowrap}
      .portal-user-row{display:grid;grid-template-columns:minmax(240px,1fr) 140px 110px 88px;align-items:center;gap:14px;min-height:56px;padding:0 14px;border-top:1px solid #e3e8e6}
      .portal-user-identity>div{display:flex;align-items:center;gap:8px}.portal-user-identity small{display:block;margin-top:3px;color:#687471}.portal-user-role{color:#42504d}.portal-user-status{text-align:center}.portal-user-actions{text-align:right}
      .portal-primary-badge{display:inline-block;padding:2px 6px;border-radius:999px;background:#e2f3ef;color:#006557;font-size:8px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
      .portal-user-edit{min-width:64px;padding:7px 12px;border:1px solid #cfd8d5;border-radius:0;background:#fff;color:#17211f;cursor:pointer;font:inherit}.portal-user-edit:hover{border-color:#006557;color:#006557}
      .portal-user-edit-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.portal-user-dialog-footer{display:grid!important;grid-template-columns:auto 1fr auto auto;align-items:center;gap:10px}.portal-user-dialog-note{margin:0;padding:0 18px 14px;color:#687471;font-size:11px;line-height:1.45}.admin-empty.compact{padding:14px}
      #createUserForm .admin-user-create-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
      @media(max-width:900px){.portal-user-row{grid-template-columns:minmax(200px,1fr) 120px 80px}.portal-user-role{display:none}#createUserForm .admin-user-create-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:650px){.portal-user-group-toggle{grid-template-columns:18px minmax(0,1fr)}.portal-user-group-meta{grid-column:2;text-align:left;white-space:normal}.portal-user-row{grid-template-columns:minmax(0,1fr) auto}.portal-user-role,.portal-user-status{display:none}.portal-user-edit-grid,#createUserForm .admin-user-create-grid{grid-template-columns:1fr}.portal-user-dialog-footer{grid-template-columns:1fr 1fr!important}.portal-user-dialog-footer span{display:none}}
    `;
    document.head.append(style);
  }

  function bindEvents() {
    const adminSection = document.getElementById("adminSection");
    if (adminSection?.dataset.portalUserEvents !== "true") {
      adminSection.dataset.portalUserEvents = "true";
      adminSection.addEventListener("click", (event) => {
        const toggle = event.target.closest(".portal-user-group-toggle");
        if (toggle) {
          event.preventDefault();
          const group = toggle.closest("[data-user-group]");
          const id = group?.dataset.userGroup;
          if (!id) return;
          openGroups.has(id) ? openGroups.delete(id) : openGroups.add(id);
          render();
          return;
        }

        const edit = event.target.closest(".portal-user-edit");
        if (edit) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          const row = edit.closest("[data-managed-user]");
          const user = model.users.find((candidate) => Number(candidate.id) === Number(row?.dataset.managedUser));
          if (user) openUserEditor(user);
          return;
        }

        const pageButton = event.target.closest("[data-user-group-page]");
        if (pageButton && !pageButton.disabled) {
          groupPage = Number(pageButton.dataset.userGroupPage || 1);
          render();
        }
      }, true);
    }
  }

  function patchLegacyRenderer() {
    const replacement = () => { void refresh(); };
    try { window.renderUsers = replacement; } catch (_error) { }
    try { renderUsers = replacement; } catch (_error) { }
  }

  function initialise() {
    if (!document.body.classList.contains("account-page")) return;
    const list = document.getElementById("usersList");
    const search = document.getElementById("userSearch");
    if (!list || !search) {
      window.setTimeout(initialise, 50);
      return;
    }

    replaceLegacyControls();
    installStyles();
    bindEvents();
    enhanceCreateUserForm();
    patchLegacyRenderer();
    void refresh();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialise, { once: true });
  else initialise();
})();
