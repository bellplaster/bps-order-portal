(() => {
  let historyData = { orders: [], viewer: null, staff: [] };
  let filters = { query: "", staff: "all", status: "all" };
  let orderPendingDeletion = null;

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
      day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit",
      timeZone: "Australia/Melbourne",
    }).format(date);
  }

  function installDrawerHeader() {
    const drawer = document.getElementById("historyDrawer");
    if (!drawer || drawer.dataset.appleHistory === "true") return;
    drawer.dataset.appleHistory = "true";
    const heading = drawer.querySelector("h1, h2, h3");
    if (heading) heading.textContent = "Order History";
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
        <label class="history-filter-search">
          <span class="sr-only">Search orders</span>
          <span class="history-search-shell">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z"/></svg>
            <input id="historySearch" type="search" placeholder="Search reference, address or staff" autocomplete="off">
          </span>
        </label>
        <div class="history-filter-row">
          <label id="historyStaffFilterField"><span>Placed by</span><select id="historyStaffFilter"><option value="all">All staff</option></select></label>
          <label><span>Status</span><select id="historyStatusFilter"><option value="all">All statuses</option><option value="completed">Completed</option><option value="processing">Processing</option></select></label>
          <button id="refreshHistoryButton" class="history-refresh" type="button" aria-label="Refresh order history" title="Refresh">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.34 5.66M20 4v7h-7"/></svg>
          </button>
        </div>
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
    installDrawerHeader();
    ensureControls();
    list.innerHTML = '<div class="history-loading"><span></span><p>Loading orders…</p></div>';
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
        const admin = historyData.viewer?.role === "admin";
        summary.innerHTML = historyData.viewer?.scope === "account"
          ? `<strong>Account history</strong><span>${admin ? "View all orders for this account. Administrators can remove test orders." : "View every order submitted under this debtor account."}</span>`
          : `<strong>My orders</strong><span>View orders submitted using your own login.</span>`;
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
      return [order.customer_reference, order.created_by_name, order.created_by_username, details.delivery_address, details.contact, details.required_date]
        .join(" ").toLowerCase().includes(filters.query);
    });
  }

  function renderHistory() {
    const list = document.getElementById("historyList");
    if (!list) return;
    const orders = filteredOrders();
    list.replaceChildren();
    if (!orders.length) {
      list.innerHTML = '<div class="history-empty"><strong>No orders found</strong><span>Try changing your search or filters.</span></div>';
      return;
    }
    orders.forEach((order) => list.append(renderOrderCard(order)));
  }

  function renderOrderCard(order) {
    const details = order.order_details || {};
    const card = document.createElement("article");
    card.className = "history-card history-audit-card";
    const creator = order.created_by_name || order.created_by_username || "Legacy order";
    const creatorLine = order.created_by_user_id
      ? `Created by ${creator} · ${formatSubmittedAt(order.created_at)}`
      : `Creator not recorded · ${formatSubmittedAt(order.created_at)}`;
    const reference = order.customer_reference || details.reference || "Untitled order";
    const status = String(order.status || "processing").toLowerCase();
    card.innerHTML = `
      <div class="history-card-top">
        <div class="history-card-heading"><span>${escapeHtml(order.company_name || details.customer || "Customer")}</span><h3>${escapeHtml(reference)}</h3></div>
        <em class="status-${escapeHtml(status)}">${escapeHtml(status)}</em>
      </div>
      <p class="history-creator">${escapeHtml(creatorLine)}</p>
      <dl>
        <div><dt>Required</dt><dd>${escapeHtml([typeof formatDate === "function" ? formatDate(details.required_date) : details.required_date, typeof timeSlotLabel === "function" ? timeSlotLabel(details.time_slot) : details.time_slot].filter(Boolean).join(" · ") || "—")}</dd></div>
        <div><dt>Delivery</dt><dd>${escapeHtml(typeof deliveryTypeLabel === "function" ? deliveryTypeLabel(details.delivery_type) : details.delivery_type || "—")}</dd></div>
        <div><dt>Address</dt><dd>${escapeHtml(typeof formatAddressForDisplay === "function" ? formatAddressForDisplay(details.delivery_address) : details.delivery_address || "—")}</dd></div>
      </dl>`;

    const footer = document.createElement("div");
    footer.className = "history-card-footer";
    const files = document.createElement("div");
    files.className = "history-files";
    const latestByFloor = new Map();
    (order.files || []).forEach((file) => {
      if (!latestByFloor.has(file.floor)) latestByFloor.set(file.floor, file);
    });
    const latestFiles = [...latestByFloor.values()];
    latestFiles.forEach((file) => {
      const link = document.createElement("a");
      link.href = file.download_url;
      link.textContent = latestFiles.length === 1 ? "Download Excel" : `Download ${file.floor_label || "order"} Excel`;
      files.append(link);
    });
    footer.append(files);

    if (historyData.viewer?.role === "admin") {
      const remove = document.createElement("button");
      remove.className = "history-delete";
      remove.type = "button";
      remove.textContent = "Delete order";
      remove.addEventListener("click", () => openDeleteDialog(order));
      footer.append(remove);
    }

    card.append(footer);
    return card;
  }

  function ensureDeleteDialog() {
    let dialog = document.getElementById("historyDeleteDialog");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "historyDeleteDialog";
    dialog.className = "history-delete-dialog";
    dialog.innerHTML = `
      <form method="dialog">
        <div class="history-dialog-icon" aria-hidden="true">!</div>
        <h2>Delete this order?</h2>
        <p id="historyDeleteMessage"></p>
        <label>Type <strong id="historyDeleteReference"></strong> to confirm<input id="historyDeleteInput" autocomplete="off" spellcheck="false"></label>
        <div class="history-dialog-actions">
          <button class="history-dialog-cancel" value="cancel">Cancel</button>
          <button id="historyDeleteConfirm" class="history-dialog-confirm" value="default" type="button" disabled>Delete order</button>
        </div>
      </form>`;
    document.body.append(dialog);
    const input = dialog.querySelector("#historyDeleteInput");
    const confirm = dialog.querySelector("#historyDeleteConfirm");
    input.addEventListener("input", () => {
      confirm.disabled = !orderPendingDeletion || input.value.trim() !== String(orderPendingDeletion.customer_reference || "").trim();
    });
    confirm.addEventListener("click", () => void deleteOrder());
    dialog.addEventListener("close", () => {
      orderPendingDeletion = null;
      input.value = "";
      confirm.disabled = true;
      confirm.textContent = "Delete order";
    });
    return dialog;
  }

  function openDeleteDialog(order) {
    orderPendingDeletion = order;
    const dialog = ensureDeleteDialog();
    const reference = String(order.customer_reference || "").trim();
    dialog.querySelector("#historyDeleteReference").textContent = reference;
    dialog.querySelector("#historyDeleteMessage").textContent = `Order ${reference} and its Excel files will be permanently removed. This cannot be undone.`;
    dialog.querySelector("#historyDeleteInput").value = "";
    dialog.querySelector("#historyDeleteConfirm").disabled = true;
    dialog.showModal();
    window.setTimeout(() => dialog.querySelector("#historyDeleteInput")?.focus(), 50);
  }

  async function deleteOrder() {
    if (!orderPendingDeletion) return;
    const dialog = ensureDeleteDialog();
    const confirm = dialog.querySelector("#historyDeleteConfirm");
    confirm.disabled = true;
    confirm.textContent = "Deleting…";
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderPendingDeletion.submission_id)}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) throw new Error(payload.error || "The order could not be deleted.");
      dialog.close();
      await loadReadOnlyHistory();
    } catch (error) {
      confirm.disabled = false;
      confirm.textContent = "Delete order";
      window.alert(error.message || String(error));
    }
  }

  function installStyles() {
    if (document.getElementById("history-audit-styles")) return;
    const style = document.createElement("style");
    style.id = "history-audit-styles";
    style.textContent = `
      #historyDrawer{width:min(560px,100vw)!important;background:#f5f5f7!important;color:#1d1d1f!important;box-shadow:-20px 0 60px rgba(0,0,0,.14)!important}
      #historyDrawer .drawer-header{min-height:76px;padding:22px 24px!important;background:rgba(255,255,255,.88)!important;backdrop-filter:saturate(180%) blur(20px);border-bottom:1px solid rgba(0,0,0,.08)!important}
      #historyDrawer .drawer-header h2,#historyDrawer .drawer-header h3{font-size:26px!important;line-height:1.1!important;font-weight:700!important;letter-spacing:-.035em!important}
      .history-controls[data-audit-controls="true"]{display:grid;gap:18px;padding:22px 24px 20px;background:rgba(255,255,255,.92);border-bottom:1px solid rgba(0,0,0,.08);position:sticky;top:76px;z-index:3;backdrop-filter:saturate(180%) blur(20px)}
      .history-access-summary{display:grid;gap:5px}.history-access-summary strong{font-size:15px;line-height:1.2}.history-access-summary span{font-size:13px;color:#6e6e73;line-height:1.45}
      .history-filter-grid{display:grid;gap:12px}.history-search-shell{height:44px;display:flex;align-items:center;gap:9px;padding:0 13px;border-radius:12px;background:#ededf0;border:1px solid transparent;transition:.2s}
      .history-search-shell:focus-within{background:#fff;border-color:#86868b;box-shadow:0 0 0 3px rgba(0,0,0,.06)}.history-search-shell svg{width:17px;height:17px;fill:none;stroke:#6e6e73;stroke-width:2;stroke-linecap:round}
      .history-search-shell input{width:100%;border:0!important;background:transparent!important;outline:0!important;padding:0!important;font-size:14px!important;color:#1d1d1f!important}
      .history-filter-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) 42px;gap:10px;align-items:end}.history-filter-row label{display:grid;gap:6px;font-size:11px;font-weight:600;color:#6e6e73}
      .history-filter-row select{height:42px;width:100%;border:1px solid #d2d2d7;border-radius:11px;background:#fff;padding:0 34px 0 12px;font-size:13px;color:#1d1d1f}
      .history-refresh{width:42px;height:42px;border:1px solid #d2d2d7;border-radius:11px;background:#fff;display:grid;place-items:center;cursor:pointer}.history-refresh:hover{background:#f2f2f4}.history-refresh svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
      #historyList{padding:18px 18px 30px!important;display:grid;gap:14px}.history-audit-card{margin:0!important;padding:20px!important;border:0!important;border-radius:18px!important;background:#fff!important;box-shadow:0 1px 2px rgba(0,0,0,.04),0 8px 24px rgba(0,0,0,.05)!important}
      .history-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.history-card-heading{min-width:0}.history-card-heading span{display:block;margin-bottom:6px;font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#86868b}.history-card-heading h3{margin:0!important;font-size:23px!important;line-height:1.1!important;font-weight:700!important;letter-spacing:-.035em!important;color:#1d1d1f!important;overflow-wrap:anywhere}
      .history-card-top em{flex:none;margin:0!important;border-radius:999px;padding:6px 9px;font-size:10px!important;line-height:1!important;font-style:normal!important;font-weight:700!important;text-transform:uppercase;letter-spacing:.03em}.status-completed{background:#e8f7f3!important;color:#006b5b!important}.status-processing{background:#fff4d8!important;color:#7a5400!important}
      .history-creator{margin:11px 0 17px!important;font-size:12px!important;line-height:1.45!important;color:#6e6e73!important}.history-audit-card dl{display:grid!important;gap:0!important;margin:0!important;border-top:1px solid #e5e5e7!important}.history-audit-card dl>div{display:grid!important;grid-template-columns:92px minmax(0,1fr)!important;gap:12px!important;padding:11px 0!important;border-bottom:1px solid #e5e5e7!important}.history-audit-card dt{font-size:11px!important;font-weight:600!important;text-transform:uppercase!important;letter-spacing:.035em!important;color:#86868b!important}.history-audit-card dd{margin:0!important;font-size:14px!important;line-height:1.4!important;color:#1d1d1f!important;overflow-wrap:anywhere}
      .history-card-footer{display:flex;justify-content:space-between;align-items:center;gap:16px;padding-top:16px}.history-files{display:flex;flex-wrap:wrap;gap:14px}.history-files:empty{display:none}.history-files a{display:inline-block!important;padding:0!important;background:none!important;border:0!important;border-radius:0!important;color:#006b5b!important;font-size:13px!important;font-weight:600!important;text-decoration:underline!important;text-underline-offset:3px!important}.history-files a:hover{color:#004c41!important}.history-delete{border:0;background:none;padding:0;color:#c62828;font-size:12px;font-weight:600;cursor:pointer}.history-delete:hover{text-decoration:underline;text-underline-offset:3px}
      .history-loading,.history-empty{min-height:180px;display:grid;place-items:center;align-content:center;gap:8px;text-align:center;color:#86868b}.history-loading span{width:24px;height:24px;border:2px solid #d2d2d7;border-top-color:#1d1d1f;border-radius:50%;animation:history-spin .8s linear infinite}.history-loading p{margin:0;font-size:13px}.history-empty strong{font-size:16px;color:#1d1d1f}.history-empty span{font-size:13px}@keyframes history-spin{to{transform:rotate(360deg)}}
      .history-delete-dialog{width:min(420px,calc(100vw - 32px));border:0;border-radius:22px;padding:0;background:#fff;color:#1d1d1f;box-shadow:0 24px 80px rgba(0,0,0,.25)}.history-delete-dialog::backdrop{background:rgba(0,0,0,.35);backdrop-filter:blur(6px)}.history-delete-dialog form{padding:28px}.history-dialog-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:50%;background:#fff0f0;color:#c62828;font-size:22px;font-weight:700}.history-delete-dialog h2{margin:18px 0 8px;font-size:24px;letter-spacing:-.03em}.history-delete-dialog p{margin:0 0 20px;color:#6e6e73;font-size:14px;line-height:1.5}.history-delete-dialog label{display:grid;gap:8px;font-size:12px;color:#6e6e73}.history-delete-dialog input{height:44px;border:1px solid #d2d2d7;border-radius:11px;padding:0 12px;font-size:15px;text-transform:none}.history-dialog-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:22px}.history-dialog-actions button{height:44px;border-radius:11px;font-size:14px;font-weight:600;cursor:pointer}.history-dialog-cancel{border:1px solid #d2d2d7;background:#fff;color:#1d1d1f}.history-dialog-confirm{border:0;background:#c62828;color:#fff}.history-dialog-confirm:disabled{opacity:.35;cursor:not-allowed}
      .sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
      @media(max-width:620px){#historyDrawer{width:100vw!important}.history-controls[data-audit-controls="true"]{padding:18px 16px}.history-filter-row{grid-template-columns:1fr 1fr 42px}#historyList{padding:14px!important}.history-audit-card{padding:18px!important}.history-card-heading h3{font-size:21px!important}.history-audit-card dl>div{grid-template-columns:82px minmax(0,1fr)!important}}
    `;
    document.head.append(style);
  }

  function install() {
    if (!document.body.classList.contains("order-form-page")) return;
    installStyles();
    installDrawerHeader();
    ensureControls();
    ensureDeleteDialog();
    try { window.loadOrderHistory = loadReadOnlyHistory; } catch (_error) { }
    try { loadOrderHistory = loadReadOnlyHistory; } catch (_error) { }
    document.getElementById("showArchivedOrders")?.closest("label")?.remove();
    void loadReadOnlyHistory();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
