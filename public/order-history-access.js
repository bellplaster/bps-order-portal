(() => {
  let historyData = { orders: [], viewer: null, staff: [] };
  let filters = { query: "", staff: "all", status: "all" };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[character]);
  }

  function formatSubmittedAt(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("en-AU", {
      day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
      timeZone: "Australia/Melbourne",
    }).format(date);
  }

  function ensureControls() {
    const drawer = document.getElementById("historyDrawer");
    const legacy = drawer?.querySelector(".history-controls");
    if (!drawer || !legacy) return null;
    if (legacy.dataset.auditControls === "true") return legacy;
    legacy.dataset.auditControls = "true";
    legacy.innerHTML = `
      <div class="history-access-summary" id="historyAccessSummary"></div>
      <div class="history-filter-grid">
        <label class="history-filter-search"><span>Search</span><input id="historySearch" type="search" placeholder="PO, address or staff" autocomplete="off"></label>
        <label id="historyStaffFilterField"><span>Placed by</span><select id="historyStaffFilter"><option value="all">All staff</option></select></label>
        <label><span>Status</span><select id="historyStatusFilter"><option value="all">All statuses</option><option value="completed">Completed</option><option value="processing">Processing</option></select></label>
        <button id="refreshHistoryButton" class="button button-secondary" type="button">Refresh</button>
      </div>`;
    legacy.querySelector("#historySearch")?.addEventListener("input", (event) => {
      filters.query = event.target.value.trim().toLowerCase();
      renderHistory();
    });
    legacy.querySelector("#historyStaffFilter")?.addEventListener("change", (event) => {
      filters.staff = event.target.value;
      renderHistory();
    });
    legacy.querySelector("#historyStatusFilter")?.addEventListener("change", (event) => {
      filters.status = event.target.value;
      renderHistory();
    });
    legacy.querySelector("#refreshHistoryButton")?.addEventListener("click", () => void loadReadOnlyHistory());
    return legacy;
  }

  function populateStaffFilter() {
    const select = document.getElementById("historyStaffFilter");
    const field = document.getElementById("historyStaffFilterField");
    const accountScope = historyData.viewer?.scope === "account";
    if (!select || !field) return;
    field.hidden = !accountScope;
    select.replaceChildren(new Option("All staff", "all"));
    if (accountScope) {
      select.append(new Option("My orders", `user:${historyData.viewer.userId}`));
      historyData.staff.forEach((user) => {
        const role = user.isAccountSupervisor ? "Account supervisor" : "Order user";
        select.append(new Option(`${user.name} — ${role}`, `user:${user.id}`));
      });
    }
    select.value = [...select.options].some((option) => option.value === filters.staff) ? filters.staff : "all";
  }

  async function loadReadOnlyHistory() {
    const list = document.getElementById("historyList");
    if (!list) return;
    ensureControls();
    list.innerHTML = '<p class="empty-state">Loading orders…</p>';
    try {
      const response = await fetch("/api/orders", { credentials: "same-origin", headers: { Accept: "application/json" } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) throw new Error(payload.error || "Order history could not be loaded.");
      historyData = {
        orders: Array.isArray(payload.orders) ? payload.orders : [],
        viewer: payload.viewer || null,
        staff: Array.isArray(payload.staff) ? payload.staff : [],
      };
      populateStaffFilter();
      const summary = document.getElementById("historyAccessSummary");
      if (summary) {
        summary.innerHTML = historyData.viewer?.scope === "account"
          ? `<strong>Account history</strong><span>You can view every order submitted under this debtor account. Orders are permanent and read-only.</span>`
          : `<strong>My orders</strong><span>You can view orders submitted using your own login. Orders are permanent and read-only.</span>`;
      }
      renderHistory();
    } catch (error) {
      list.innerHTML = `<p class="empty-state">${escapeHtml(error.message || String(error))}</p>`;
    }
  }

  function filteredOrders() {
    return historyData.orders.filter((order) => {
      if (filters.status !== "all" && String(order.status || "").toLowerCase() !== filters.status) return false;
      if (filters.staff.startsWith("user:") && Number(order.created_by_user_id || 0) !== Number(filters.staff.slice(5))) return false;
      if (!filters.query) return true;
      const details = order.order_details || {};
      return [
        order.customer_reference,
        order.created_by_name,
        order.created_by_username,
        details.delivery_address,
        details.contact,
        details.required_date,
      ].join(" ").toLowerCase().includes(filters.query);
    });
  }

  function renderHistory() {
    const list = document.getElementById("historyList");
    if (!list) return;
    const orders = filteredOrders();
    list.replaceChildren();
    if (!orders.length) {
      list.innerHTML = '<p class="empty-state">No orders match these filters.</p>';
      return;
    }
    orders.forEach((order) => list.append(renderOrderCard(order)));
  }

  function renderOrderCard(order) {
    const details = order.order_details || {};
    const card = document.createElement("article");
    card.className = "history-card history-audit-card";
    const creator = order.created_by_name || order.created_by_username || "Legacy order";
    const username = order.created_by_username ? `@${order.created_by_username}` : "Creator not recorded";
    card.innerHTML = `
      <div class="history-card-top">
        <div><span>${escapeHtml(order.company_name || details.customer || "Customer")}</span><h3>${escapeHtml(order.customer_reference)}</h3></div>
        <em class="status-${escapeHtml(order.status)}">${escapeHtml(order.status)}</em>
      </div>
      <div class="history-creator"><strong>${escapeHtml(creator)}</strong><span>${escapeHtml(username)} · ${escapeHtml(formatSubmittedAt(order.created_at))}</span></div>
      <dl>
        <div><dt>Required</dt><dd>${escapeHtml([typeof formatDate === "function" ? formatDate(details.required_date) : details.required_date, typeof timeSlotLabel === "function" ? timeSlotLabel(details.time_slot) : details.time_slot].filter(Boolean).join(" · ") || "—")}</dd></div>
        <div><dt>Delivery</dt><dd>${escapeHtml(typeof deliveryTypeLabel === "function" ? deliveryTypeLabel(details.delivery_type) : details.delivery_type || "—")}</dd></div>
        <div><dt>Address</dt><dd>${escapeHtml(typeof formatAddressForDisplay === "function" ? formatAddressForDisplay(details.delivery_address) : details.delivery_address || "—")}</dd></div>
      </dl>`;

    const files = document.createElement("div");
    files.className = "history-files";
    const latestByFloor = new Map();
    (order.files || []).forEach((file) => {
      if (!latestByFloor.has(file.floor)) latestByFloor.set(file.floor, file);
    });
    latestByFloor.forEach((file) => {
      const link = document.createElement("a");
      link.href = file.download_url;
      link.textContent = `Download ${file.floor_label} XLSX`;
      files.append(link);
    });
    card.append(files);
    return card;
  }

  function installStyles() {
    if (document.getElementById("history-audit-styles")) return;
    const style = document.createElement("style");
    style.id = "history-audit-styles";
    style.textContent = `
      .history-controls[data-audit-controls="true"]{display:grid;gap:12px;padding:14px 16px;border-bottom:1px solid #d8dfdd}
      .history-access-summary{display:grid;gap:3px}.history-access-summary strong{font-size:12px}.history-access-summary span{font-size:10px;color:#687471;line-height:1.4}
      .history-filter-grid{display:grid;grid-template-columns:minmax(150px,1fr) minmax(145px,.8fr) minmax(120px,.65fr) auto;gap:8px;align-items:end}
      .history-filter-grid label{display:grid;gap:4px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#687471}
      .history-filter-grid input,.history-filter-grid select{width:100%;min-height:36px;border:1px solid #cfd8d5;background:#fff;padding:0 10px;font:inherit;color:#17211f}
      .history-filter-grid .button{min-height:36px;white-space:nowrap}
      .history-audit-card .history-creator{display:grid;gap:2px;padding:10px 0;border-top:1px solid #e3e8e6;border-bottom:1px solid #e3e8e6}
      .history-audit-card .history-creator strong{font-size:11px}.history-audit-card .history-creator span{font-size:9px;color:#687471}
      .history-audit-card .history-files:empty{display:none}
      .history-audit-card .history-actions{display:none!important}
      @media(max-width:620px){.history-filter-grid{grid-template-columns:1fr 1fr}.history-filter-search{grid-column:1/-1}.history-filter-grid .button{width:100%}}
    `;
    document.head.append(style);
  }

  function install() {
    if (!document.body.classList.contains("order-form-page")) return;
    installStyles();
    ensureControls();
    try { window.loadOrderHistory = loadReadOnlyHistory; } catch (_error) { }
    try { loadOrderHistory = loadReadOnlyHistory; } catch (_error) { }
    document.getElementById("showArchivedOrders")?.closest("label")?.remove();
    void loadReadOnlyHistory();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
