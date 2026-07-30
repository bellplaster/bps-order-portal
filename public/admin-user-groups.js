(() => {
  let users = [];
  let renderTimer = 0;
  let loading = false;

  const start = () => {
    const list = document.getElementById("usersList");
    if (!list) return;

    document.getElementById("userSearch")?.addEventListener("input", scheduleRender);
    new MutationObserver(() => scheduleRender()).observe(list, { childList: true });
    void refresh();
  };

  async function refresh() {
    if (loading) return;
    loading = true;
    try {
      const response = await fetch("/api/account-contacts?all=1", { headers: { Accept: "application/json" } });
      if (!response.ok) return;
      const result = await response.json();
      users = result.contacts || [];
      renderGroupedUsers();
    } catch (_error) {
      // The existing administration table remains available if grouping cannot load.
    } finally {
      loading = false;
    }
  }

  function scheduleRender() {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(() => {
      if (!users.length) void refresh();
      else renderGroupedUsers();
    }, 0);
  }

  function renderGroupedUsers() {
    const list = document.getElementById("usersList");
    if (!list || !users.length) return;
    const query = String(document.getElementById("userSearch")?.value || "").trim().toLowerCase();
    const filtered = users.filter((user) => [
      user.username,
      user.contactName,
      user.mobile,
      user.companyName,
      user.debtorCode,
      user.role,
    ].join(" ").toLowerCase().includes(query));

    const groups = new Map();
    filtered.forEach((user) => {
      const key = user.role === "admin" ? "__ADMIN__" : String(user.accountId || "__UNASSIGNED__");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(user);
    });

    list.replaceChildren();
    document.getElementById("usersCount").textContent = `${filtered.length} ${filtered.length === 1 ? "user" : "users"}`;
    document.getElementById("usersPagination")?.replaceChildren();

    if (!filtered.length) {
      list.innerHTML = '<div class="admin-empty">No portal users match this search.</div>';
      return;
    }

    [...groups.entries()]
      .sort(([, left], [, right]) => groupLabel(left[0]).localeCompare(groupLabel(right[0])))
      .forEach(([, groupUsers]) => {
        const first = groupUsers[0];
        const heading = document.createElement("div");
        heading.className = "admin-user-group-heading";
        heading.innerHTML = `<div><strong>${escapeHtml(groupLabel(first))}</strong><span>${escapeHtml(first.debtorCode || (first.role === "admin" ? "Administration" : "No debtor code"))}</span></div><b>${groupUsers.length} ${groupUsers.length === 1 ? "user" : "users"}</b>`;
        list.append(heading);

        groupUsers
          .sort((a, b) => Number(isPrimary(b)) - Number(isPrimary(a)) || a.username.localeCompare(b.username))
          .forEach((user) => list.append(buildRow(user)));
      });
  }

  function buildRow(user) {
    const row = document.createElement("div");
    row.className = "admin-table-row admin-user-columns admin-user-group-row";
    row.dataset.userId = user.id;
    const primary = isPrimary(user);
    const contact = [user.contactName, user.mobile].filter(Boolean).join(" · ") || "No saved contact";
    row.innerHTML = `
      <div class="admin-primary-cell"><strong>${escapeHtml(user.username)}${primary ? '<em class="primary-user-badge">Primary</em>' : ""}</strong><span>${escapeHtml(contact)}</span></div>
      <div>${escapeHtml(user.companyName || "Bell Plaster")}</div>
      <div><span class="status-badge ${user.active ? "is-active" : "is-inactive"}">${user.active ? "Active" : "Inactive"}</span></div>
      <div class="admin-row-actions">
        <button type="button" data-user-action="toggle">${user.active ? "Deactivate" : "Activate"}</button>
        <button class="is-danger" type="button" data-user-action="delete">Delete</button>
      </div>`;
    return row;
  }

  function isPrimary(user) {
    const username = String(user.username || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
    const debtor = String(user.debtorCode || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
    return Boolean(username && debtor && (username === debtor || debtor.startsWith(username)));
  }

  function groupLabel(user) {
    return user?.role === "admin" ? "Bell Plaster administrators" : (user?.companyName || "Unassigned users");
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  const style = document.createElement("style");
  style.textContent = `
    .admin-user-group-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 10px 12px;
      background: #f2f5f4;
      border-top: 1px solid #d8dfdd;
      border-bottom: 1px solid #d8dfdd;
    }
    .admin-user-group-heading div { display: grid; gap: 2px; }
    .admin-user-group-heading strong { font-size: 12px; color: #17211f; }
    .admin-user-group-heading span,
    .admin-user-group-heading b { font-size: 10px; color: #6b7774; font-weight: 500; }
    .admin-user-group-row { padding-left: 22px; }
    .primary-user-badge {
      display: inline-block;
      margin-left: 8px;
      padding: 2px 5px;
      border-radius: 999px;
      background: #e5f3ef;
      color: #006557;
      font-size: 8px;
      font-style: normal;
      text-transform: uppercase;
      letter-spacing: .04em;
      vertical-align: middle;
    }
  `;
  document.head.append(style);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
