let data = null;

document.addEventListener("DOMContentLoaded", initialise);

async function initialise() {
  document.getElementById("logoutButton").addEventListener("click", logout);
  document.getElementById("accountForm").addEventListener("submit", saveAccount);
  document.getElementById("passwordForm").addEventListener("submit", changePassword);
  document.getElementById("createAccountForm").addEventListener("submit", createAccount);
  document.getElementById("createUserForm").addEventListener("submit", createUser);
  document.getElementById("newUserRole").addEventListener("change", toggleUserAccount);
  document.getElementById("defaultMobile").addEventListener("input", formatMobileField);
  document.getElementById("newDefaultMobile").addEventListener("input", formatMobileField);
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
    if (profile.role === "admin") {
      document.getElementById("customerAccountCard").hidden = true;
      document.getElementById("adminSection").hidden = false;
      renderAdminData();
    }
  } catch (error) {
    showMessage(error.message || String(error), "error");
  }
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
      }),
    });
    showMessage("Account details saved.", "success");
    await loadAccount();
  } catch (error) {
    showMessage(error.message || String(error), "error");
  }
}

async function changePassword(event) {
  event.preventDefault();
  const newPassword = document.getElementById("newPassword").value;
  if (newPassword !== document.getElementById("confirmPassword").value) {
    showMessage("New passwords do not match.", "error");
    return;
  }
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
    showMessage("Password changed.", "success");
  } catch (error) {
    showMessage(error.message || String(error), "error");
  }
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
        defaultContactName: document.getElementById("newDefaultContact").value,
        defaultMobile: document.getElementById("newDefaultMobile").value,
      }),
    });
    event.target.reset();
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
    document.getElementById("newUserRole").value = "customer";
    showMessage("Portal user created.", "success");
    await loadAccount();
  } catch (error) {
    showMessage(error.message || String(error), "error");
  }
}

function renderAdminData() {
  const accountsList = document.getElementById("accountsList");
  accountsList.replaceChildren();
  (data.accounts || []).forEach((account) => {
    const row = document.createElement("div");
    row.className = "admin-list-row";
    row.innerHTML = `<strong>${escapeHtml(account.company_name)}</strong><span>${escapeHtml(account.debtor_code)} · ${account.active ? "Active" : "Inactive"}</span>`;
    accountsList.append(row);
  });

  const select = document.getElementById("newUserAccount");
  select.replaceChildren(new Option("Choose customer account", ""));
  (data.accounts || []).filter((account) => account.active).forEach((account) => select.append(new Option(`${account.company_name} — ${account.debtor_code}`, account.id)));

  const usersList = document.getElementById("usersList");
  usersList.replaceChildren();
  (data.users || []).forEach((user) => {
    const row = document.createElement("div");
    row.className = "admin-list-row";
    row.innerHTML = `<strong>${escapeHtml(user.username)}</strong><span>${escapeHtml(user.role)} · ${escapeHtml(user.company_name || "Bell administrator")} · ${user.active ? "Active" : "Inactive"}</span>`;
    usersList.append(row);
  });
  toggleUserAccount();
}

function toggleUserAccount() {
  const admin = document.getElementById("newUserRole").value === "admin";
  document.getElementById("newUserAccount").disabled = admin;
  if (admin) document.getElementById("newUserAccount").value = "";
}

function formatMobileField(event) {
  const digits = event.target.value.replace(/\D/g, "").slice(0, 10);
  event.target.value = [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7)].filter(Boolean).join(" ");
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
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '\"': "&quot;" })[character]); }
