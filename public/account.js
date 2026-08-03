let data = null;

const ORDER_DEFAULT_FIELDS = [
  "defaultReference",
  "defaultRequiredDate",
  "defaultStreet",
  "defaultSuburb",
  "defaultPostcode",
  "defaultTimeSlot",
  "defaultDeliveryType",
  "defaultInstructions",
];

const ADMIN_PAGE_SIZE = 20;
const adminState = {
  accountQuery: "",
  accountPage: 1,
  userQuery: "",
  userPage: 1,
};
let pendingConfirmation = null;

document.addEventListener("DOMContentLoaded", initialise);

async function initialise() {
  document.getElementById("logoutButton")?.addEventListener("click", logout);
  document.getElementById("accountForm")?.addEventListener("submit", saveAccount);
  document.getElementById("passwordForm")?.addEventListener("submit", changePassword);
  document.getElementById("togglePasswordPanel")?.addEventListener("click", () => togglePasswordPanel());
  document.getElementById("cancelPasswordChange")?.addEventListener("click", () => togglePasswordPanel(false));
  document.getElementById("createAccountForm")?.addEventListener("submit", createAccount);
  document.getElementById("createUserForm")?.addEventListener("submit", createUser);
  document.getElementById("editAccountForm")?.addEventListener("submit", saveEditedAccount);
  document.getElementById("newUserRole")?.addEventListener("change", toggleUserAccount);
  document.getElementById("defaultMobile")?.addEventListener("input", formatMobileField);
  document.getElementById("defaultPostcode")?.addEventListener("input", (event) => {
    event.target.value = event.target.value.replace(/\D/g, "").slice(0, 4);
  });

  document.getElementById("adminSection")?.addEventListener("click", handleAdminClick);
  document.getElementById("accountsList")?.addEventListener("click", handleAccountAction);
  document.getElementById("usersList")?.addEventListener("click", handleUserAction);
  document.getElementById("accountSearch")?.addEventListener("input", (event) => {
    adminState.accountQuery = event.target.value.trim().toLowerCase();
    adminState.accountPage = 1;
    renderAccounts();
  });
  document.getElementById("userSearch")?.addEventListener("input", (event) => {
    adminState.userQuery = event.target.value.trim().toLowerCase();
    adminState.userPage = 1;
    renderUsers();
  });
  document.getElementById("accountsPagination")?.addEventListener("click", handlePagination);
  document.getElementById("usersPagination")?.addEventListener("click", handlePagination);
  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => closeDialog(button.dataset.closeDialog));
  });
  document.getElementById("adminConfirmForm")?.addEventListener("submit", resolveConfirmation);

  await loadAccount();
}

async function loadAccount() {
  try {
    data = await fetchJson("/api/account");
    const profile = data.profile;
    document.getElementById("debtorCodeDisplay").textContent = profile.debtorCode || "Administrator";
    document.getElementById("usernameDisplay").textContent = profile.username;
    document.getElementById("companyName").value = profile.companyName || "";
    document.getElementById("defaultContactName").value = profile.defaultContactName || "";
    document.getElementById("defaultMobile").value = profile.defaultMobile || "";
    fillOrderDefaults(profile.orderDefaults || {});
    if (profile.role === "admin") {
      document.getElementById("accountForm").hidden = true;
      document.getElementById("adminSection").hidden = false;
      const heading = document.querySelector(".account-heading h1");
      const headingCopy = document.querySelector(".account-heading p");
      if (heading) heading.textContent = "Administration";
      if (headingCopy) headingCopy.hidden = true;
      renderAdminData();
    }
  } catch (error) {
    showMessage(error.message || String(error), "error");
  }
}

function fillOrderDefaults(defaults) {
  const values = {
    defaultReference: defaults.reference || "",
    defaultRequiredDate: defaults.requiredDate || "",
    defaultStreet: defaults.street || "",
    defaultSuburb: defaults.suburb || "",
    defaultPostcode: defaults.postcode || "",
    defaultTimeSlot: defaults.timeSlot || "",
    defaultDeliveryType: defaults.deliveryType || "",
    defaultInstructions: defaults.instructions || "",
  };
  ORDER_DEFAULT_FIELDS.forEach((id) => {
    const field = document.getElementById(id);
    if (field) field.value = values[id] || "";
  });
}

function collectOrderDefaults() {
  return {
    reference: document.getElementById("defaultReference").value,
    requiredDate: document.getElementById("defaultRequiredDate").value,
    street: document.getElementById("defaultStreet").value,
    suburb: document.getElementById("defaultSuburb").value,
    state: "VIC",
    postcode: document.getElementById("defaultPostcode").value,
    timeSlot: document.getElementById("defaultTimeSlot").value,
    deliveryType: document.getElementById("defaultDeliveryType").value,
    instructions: document.getElementById("defaultInstructions").value,
  };
}

async function saveAccount(event) {
  event.preventDefault();
  try {
    await fetchJson("/api/account", {
      method: "PUT",
      body: JSON.stringify({
        companyName: document.getElementById("companyName").value,
        defaultContactName: document.getElementById("defaultContactName").value,
        defaultMobile: document.getElementById("defaultMobile").value,
        orderDefaults: collectOrderDefaults(),
      }),
    });
    showMessage("Account details and order defaults saved.", "success");
    await loadAccount();
  } catch (error) {
    showMessage(error.message || String(error), "error");
  }
}

async function changePassword(event) {
  event.preventDefault();
  const newPassword = document.getElementById("newPassword").value;
  if (newPassword.length < 8) return showMessage("Password must contain at least 8 characters.", "error");
  if (newPassword !== document.getElementById("confirmPassword").value) return showMessage("New passwords do not match.", "error");
  try {
    await fetchJson("/api/account", {
      method: "POST",
      body: JSON.stringify({
        action: "change_password",
        currentPassword: document.getElementById("currentPassword").value,
        newPassword,
      }),
    });
    event.target.reset();
    togglePasswordPanel(false);
    showMessage("Password changed.", "success");
  } catch (error) {
    showMessage(error.message || String(error), "error");
  }
}

function togglePasswordPanel(force) {
  const panel = document.getElementById("passwordPanel");
  const button = document.getElementById("togglePasswordPanel");
  if (!panel || !button) return;
  const open = typeof force === "boolean" ? force : panel.hidden;
  panel.hidden = !open;
  button.setAttribute("aria-expanded", String(open));
  button.querySelector("b").textContent = open ? "Close" : "Change";
  if (open) window.setTimeout(() => document.getElementById("currentPassword")?.focus(), 0);
  else document.getElementById("passwordForm")?.reset();
}

async function createAccount(event) {
  event.preventDefault();
  try {
    await fetchJson("/api/account", {
      method: "POST",
      body: JSON.stringify({
        action: "create_account",
        debtorCode: document.getElementById("newDebtorCode").value,
        companyName: document.getElementById("newCompanyName").value,
      }),
    });
    event.target.reset();
    event.target.hidden = true;
    showMessage("Customer account created.", "success");
    await loadAccount();
  } catch (error) {
    showMessage(error.message || String(error), "error");
  }
}

async function createUser(event) {
  event.preventDefault();
  try {
    await fetchJson("/api/account", {
      method: "POST",
      body: JSON.stringify({
        action: "create_user",
        username: document.getElementById("newUsername").value,
        role: document.getElementById("newUserRole").value,
        accountId: document.getElementById("newUserAccount").value,
        password: document.getElementById("newUserPassword").value,
      }),
    });
    event.target.reset();
    event.target.hidden = true;
    document.getElementById("newUserRole").value = "customer";
    showMessage("Portal user created.", "success");
    await loadAccount();
  } catch (error) {
    showMessage(error.message || String(error), "error");
  }
}

async function saveEditedAccount(event) {
  event.preventDefault();
  const accountId = Number(document.getElementById("editAccountId").value || 0);
  if (!accountId) return;
  try {
    await fetchJson("/api/account", {
      method: "PUT",
      body: JSON.stringify({
        accountId,
        debtorCode: document.getElementById("editDebtorCode").value,
        companyName: document.getElementById("editCompanyName").value,
        active: document.getElementById("editAccountActive").value === "1",
      }),
    });
    closeDialog("editAccountDialog");
    showMessage("Customer account updated.", "success");
    await loadAccount();
  } catch (error) {
    showMessage(error.message || String(error), "error");
  }
}

function handleAdminClick(event) {
  const tab = event.target.closest("[data-admin-tab]");
  if (tab) return setAdminTab(tab.dataset.adminTab);
  if (event.target.closest("#openCreateAccount")) return openCreatePanel("createAccountForm", "newDebtorCode");
  if (event.target.closest("#cancelCreateAccount")) return closeCreatePanel("createAccountForm");
  if (event.target.closest("#openCreateUser")) return openCreatePanel("createUserForm", "newUsername");
  if (event.target.closest("#cancelCreateUser")) return closeCreatePanel("createUserForm");
}

function setAdminTab(name) {
  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    const active = button.dataset.adminTab === name;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll("[data-admin-panel]").forEach((panel) => {
    const active = panel.dataset.adminPanel === name;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  });
}

function openCreatePanel(id, focusId) {
  const panel = document.getElementById(id);
  if (!panel) return;
  panel.hidden = false;
  window.setTimeout(() => document.getElementById(focusId)?.focus(), 0);
}

function closeCreatePanel(id) {
  const panel = document.getElementById(id);
  panel?.reset();
  if (panel) panel.hidden = true;
}

function renderAdminData() {
  renderAccounts();
  renderUsers();
  populateAccountSelect();
  toggleUserAccount();
}

function renderAccounts() {
  const all = data?.accounts || [];
  const query = adminState.accountQuery;
  const filtered = all.filter((account) => `${account.company_name} ${account.debtor_code}`.toLowerCase().includes(query));
  const page = clampPage(adminState.accountPage, filtered.length);
  adminState.accountPage = page;
  const start = (page - 1) * ADMIN_PAGE_SIZE;
  const visible = filtered.slice(start, start + ADMIN_PAGE_SIZE);

  document.getElementById("accountsCount").textContent = countText(filtered.length, "customer");
  const list = document.getElementById("accountsList");
  list.replaceChildren();
  if (!visible.length) {
    list.innerHTML = '<div class="admin-empty">No customer accounts match this search.</div>';
  } else {
    visible.forEach((account) => list.append(buildAccountRow(account)));
  }
  renderPagination("accountsPagination", "accounts", page, filtered.length);
}

function buildAccountRow(account) {
  const row = document.createElement("div");
  row.className = "admin-table-row admin-account-columns";
  row.dataset.accountId = account.id;
  const users = Number(account.user_count || 0);
  const orders = Number(account.order_count || 0);
  row.innerHTML = `
    <div class="admin-primary-cell"><strong>${escapeHtml(account.company_name)}</strong><span>${escapeHtml(account.debtor_code)}</span></div>
    <div class="admin-usage-cell"><span>${users} ${users === 1 ? "user" : "users"}</span><span>${orders} ${orders === 1 ? "order" : "orders"}</span></div>
    <div><span class="status-badge ${account.active ? "is-active" : "is-inactive"}">${account.active ? "Active" : "Inactive"}</span></div>
    <div class="admin-row-actions">
      <button type="button" data-account-action="edit">Edit</button>
      <button type="button" data-account-action="toggle">${account.active ? "Deactivate" : "Activate"}</button>
      <button class="is-danger" type="button" data-account-action="delete">Delete</button>
    </div>`;
  return row;
}

function renderUsers() {
  const all = data?.users || [];
  const query = adminState.userQuery;
  const filtered = all.filter((user) => `${user.username} ${user.company_name || "Bell administrator"} ${user.role}`.toLowerCase().includes(query));
  const page = clampPage(adminState.userPage, filtered.length);
  adminState.userPage = page;
  const start = (page - 1) * ADMIN_PAGE_SIZE;
  const visible = filtered.slice(start, start + ADMIN_PAGE_SIZE);

  document.getElementById("usersCount").textContent = countText(filtered.length, "user");
  const list = document.getElementById("usersList");
  list.replaceChildren();
  if (!visible.length) {
    list.innerHTML = '<div class="admin-empty">No portal users match this search.</div>';
  } else {
    visible.forEach((user) => list.append(buildUserRow(user)));
  }
  renderPagination("usersPagination", "users", page, filtered.length);
}

function buildUserRow(user) {
  const row = document.createElement("div");
  row.className = "admin-table-row admin-user-columns";
  row.dataset.userId = user.id;
  row.innerHTML = `
    <div class="admin-primary-cell"><strong>${escapeHtml(user.username)}</strong><span>${user.role === "admin" ? "Administrator" : "Customer"}</span></div>
    <div>${escapeHtml(user.company_name || "Bell Plaster")}</div>
    <div><span class="status-badge ${user.active ? "is-active" : "is-inactive"}">${user.active ? "Active" : "Inactive"}</span></div>
    <div class="admin-row-actions">
      <button type="button" data-user-action="toggle">${user.active ? "Deactivate" : "Activate"}</button>
      <button class="is-danger" type="button" data-user-action="delete">Delete</button>
    </div>`;
  return row;
}

function populateAccountSelect() {
  const select = document.getElementById("newUserAccount");
  select.replaceChildren(new Option("Choose customer account", ""));
  (data?.accounts || []).filter((account) => account.active).forEach((account) => {
    select.append(new Option(`${account.company_name} — ${account.debtor_code}`, account.id));
  });
}

async function handleAccountAction(event) {
  const button = event.target.closest("[data-account-action]");
  const row = button?.closest("[data-account-id]");
  if (!button || !row) return;
  const account = (data?.accounts || []).find((candidate) => Number(candidate.id) === Number(row.dataset.accountId));
  if (!account) return;

  const action = button.dataset.accountAction;
  if (action === "edit") return openAccountEditor(account);
  if (action === "toggle") return setAccountActive(account, !account.active);
  if (action === "delete") return deleteAccount(account);
}

function openAccountEditor(account) {
  document.getElementById("editAccountId").value = account.id;
  document.getElementById("editDebtorCode").value = account.debtor_code || "";
  document.getElementById("editCompanyName").value = account.company_name || "";
  document.getElementById("editAccountActive").value = account.active ? "1" : "0";
  document.getElementById("editAccountMeta").textContent = `${Number(account.user_count || 0)} users · ${Number(account.order_count || 0)} orders`;
  openDialog("editAccountDialog");
}

async function setAccountActive(account, active) {
  const confirmed = await confirmAdmin({
    title: active ? "Activate customer" : "Deactivate customer",
    message: `${active ? "Restore" : "Suspend"} portal access for ${account.company_name}?`,
    confirmLabel: active ? "Activate" : "Deactivate",
    danger: !active,
  });
  if (!confirmed) return;
  try {
    await fetchJson("/api/account", {
      method: "POST",
      body: JSON.stringify({ action: "set_account_active", accountId: account.id, active }),
    });
    showMessage(`Customer ${active ? "activated" : "deactivated"}.`, "success");
    await loadAccount();
  } catch (error) {
    showMessage(error.message || String(error), "error");
  }
}

async function deleteAccount(account) {
  const users = Number(account.user_count || 0);
  const orders = Number(account.order_count || 0);
  if (users || orders) {
    showMessage(`This customer cannot be deleted while it has ${users} linked ${users === 1 ? "user" : "users"} or ${orders} linked ${orders === 1 ? "order" : "orders"}. Deactivate it instead.`, "error");
    return;
  }
  const confirmed = await confirmAdmin({
    title: "Delete customer",
    message: `Permanently delete ${account.company_name}? This cannot be undone.`,
    confirmLabel: "Delete customer",
    danger: true,
    confirmationText: account.debtor_code,
  });
  if (!confirmed) return;
  try {
    await fetchJson("/api/account", {
      method: "POST",
      body: JSON.stringify({ action: "delete_account", accountId: account.id }),
    });
    showMessage("Customer account deleted.", "success");
    await loadAccount();
  } catch (error) {
    showMessage(error.message || String(error), "error");
  }
}

async function handleUserAction(event) {
  const button = event.target.closest("[data-user-action]");
  const row = button?.closest("[data-user-id]");
  if (!button || !row) return;
  const user = (data?.users || []).find((candidate) => Number(candidate.id) === Number(row.dataset.userId));
  if (!user) return;

  if (button.dataset.userAction === "toggle") return setUserActive(user, !user.active);
  if (button.dataset.userAction === "delete") return deleteUser(user);
}

async function setUserActive(user, active) {
  const confirmed = await confirmAdmin({
    title: active ? "Activate user" : "Deactivate user",
    message: `${active ? "Restore" : "Suspend"} access for ${user.username}?`,
    confirmLabel: active ? "Activate" : "Deactivate",
    danger: !active,
  });
  if (!confirmed) return;
  try {
    await fetchJson("/api/account", {
      method: "POST",
      body: JSON.stringify({ action: "set_user_active", userId: user.id, active }),
    });
    showMessage(`User ${active ? "activated" : "deactivated"}.`, "success");
    await loadAccount();
  } catch (error) {
    showMessage(error.message || String(error), "error");
  }
}

async function deleteUser(user) {
  const confirmed = await confirmAdmin({
    title: "Delete portal user",
    message: `Permanently delete ${user.username}? This cannot be undone.`,
    confirmLabel: "Delete user",
    danger: true,
    confirmationText: user.username,
  });
  if (!confirmed) return;
  try {
    await fetchJson("/api/account", {
      method: "POST",
      body: JSON.stringify({ action: "delete_user", userId: user.id }),
    });
    showMessage("Portal user deleted.", "success");
    await loadAccount();
  } catch (error) {
    showMessage(error.message || String(error), "error");
  }
}

function toggleUserAccount() {
  const role = document.getElementById("newUserRole");
  const account = document.getElementById("newUserAccount");
  if (!role || !account) return;
  const customer = role.value === "customer";
  account.disabled = !customer;
  account.required = customer;
  if (!customer) account.value = "";
  const empty = account.options[0];
  if (empty) empty.textContent = customer ? "Choose customer account" : "No customer account required";
}

function handlePagination(event) {
  const button = event.target.closest("[data-page-kind][data-page]");
  if (!button) return;
  const page = Number(button.dataset.page || 1);
  if (button.dataset.pageKind === "accounts") {
    adminState.accountPage = page;
    renderAccounts();
  } else {
    adminState.userPage = page;
    renderUsers();
  }
}

function renderPagination(id, kind, page, total) {
  const container = document.getElementById(id);
  const pages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  container.replaceChildren();
  if (pages <= 1) return;
  container.innerHTML = `
    <span>Page ${page} of ${pages}</span>
    <div><button type="button" data-page-kind="${kind}" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>Previous</button><button type="button" data-page-kind="${kind}" data-page="${page + 1}" ${page >= pages ? "disabled" : ""}>Next</button></div>`;
}

function clampPage(page, total) {
  return Math.min(Math.max(1, page), Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)));
}

function countText(count, singular) {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

function openDialog(id) {
  const dialog = document.getElementById(id);
  if (!dialog) return;
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function closeDialog(id) {
  const dialog = document.getElementById(id);
  if (!dialog) return;
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
  if (id === "adminConfirmDialog" && pendingConfirmation) {
    pendingConfirmation.resolve(false);
    pendingConfirmation = null;
  }
}

function confirmAdmin({ title, message, confirmLabel, danger = false, confirmationText = "" }) {
  if (pendingConfirmation) pendingConfirmation.resolve(false);
  const field = document.getElementById("adminConfirmField");
  const input = document.getElementById("adminConfirmInput");
  document.getElementById("adminConfirmTitle").textContent = title;
  document.getElementById("adminConfirmMessage").textContent = message;
  document.getElementById("adminConfirmButton").textContent = confirmLabel;
  document.getElementById("adminConfirmButton").className = `button ${danger ? "button-danger" : "button-primary"}`;
  field.hidden = !confirmationText;
  input.value = "";
  input.dataset.expected = confirmationText;
  document.getElementById("adminConfirmLabel").textContent = confirmationText ? `Type ${confirmationText} to confirm` : "";
  openDialog("adminConfirmDialog");
  window.setTimeout(() => (confirmationText ? input : document.getElementById("adminConfirmButton"))?.focus(), 0);
  return new Promise((resolve) => { pendingConfirmation = { resolve }; });
}

function resolveConfirmation(event) {
  event.preventDefault();
  if (!pendingConfirmation) return;
  const input = document.getElementById("adminConfirmInput");
  const expected = input.dataset.expected || "";
  if (expected && input.value.trim().toLowerCase() !== expected.trim().toLowerCase()) {
    input.setCustomValidity("The confirmation text does not match.");
    input.reportValidity();
    input.setCustomValidity("");
    return;
  }
  const { resolve } = pendingConfirmation;
  pendingConfirmation = null;
  const dialog = document.getElementById("adminConfirmDialog");
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
  resolve(true);
}

function formatMobileField(event) {
  let digits = event.target.value.replace(/\D/g, "");
  if (digits.startsWith("61")) digits = `0${digits.slice(2)}`;
  digits = digits.slice(0, 10);
  if (digits.startsWith("04")) event.target.value = [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7)].filter(Boolean).join(" ");
  else if (/^0[2378]/.test(digits)) event.target.value = [digits.slice(0, 2), digits.slice(2, 6), digits.slice(6)].filter(Boolean).join(" ");
  else if (/^(1300|1800)/.test(digits)) event.target.value = [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7)].filter(Boolean).join(" ");
  else if (digits.startsWith("13")) event.target.value = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6)].filter(Boolean).join(" ");
  else event.target.value = digits;
}

async function logout() {
  await fetch("/api/logout", { method: "POST" }).catch(() => null);
  window.location.replace("/signin/");
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", Accept: "application/json", ...(options.headers || {}) },
  });
  if (response.status === 401) {
    window.location.replace("/signin/");
    throw new Error("Authentication required.");
  }
  const result = await response.json().catch(() => ({ ok: false, error: "Unreadable server response." }));
  if (!response.ok || result.ok === false) throw new Error(result.error || "Request failed.");
  return result;
}

function showMessage(message, type) {
  const box = document.getElementById("accountMessage");
  box.textContent = message;
  box.className = `portal-message is-${type}`;
  box.hidden = false;
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '\"': "&quot;" })[character]);
}