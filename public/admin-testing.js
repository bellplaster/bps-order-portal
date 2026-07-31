(() => {
  const MAX_QUANTITY = 99999;
  const RANDOM_QUANTITIES = [1, 2, 5, 10, 25, 50, 100, 250, 500, 999, 5000, 10000, 50000, 99999];
  let initialised = false;

  installStyles();

  function start() {
    if (initialised) return;
    if (typeof state === "undefined" || state.account?.role !== "admin") {
      window.setTimeout(start, 100);
      return;
    }

    const tools = document.getElementById("adminOrderTools");
    if (!tools) return;

    const accountId = Number(state.account.accountId || 0);
    if (!accountId) {
      tools.hidden = true;
      return;
    }

    initialised = true;
    state.adminOrderAccountId = accountId;

    const company = String(state.account.companyName || "Bell Plaster");
    const debtor = String(state.account.debtorCode || "STAFF");
    tools.hidden = false;
    tools.className = "admin-order-tools admin-testing-toolbar";
    tools.innerHTML = `
      <div class="admin-testing-identity">
        <span>Admin testing</span>
        <strong>${escapeHtml(company)}</strong>
        <small>Debtor ${escapeHtml(debtor)}</small>
      </div>
      <div class="admin-testing-controls">
        <label for="adminTestQuantity">Fill active tab</label>
        <input id="adminTestQuantity" type="text" inputmode="numeric" pattern="[0-9]{1,5}" maxlength="5" value="1" aria-label="Test quantity from 1 to 99999">
        <button id="fillActiveAreaButton" class="button button-secondary" type="button">Apply</button>
        <button id="randomActiveAreaButton" class="button button-secondary" type="button">Random quantities</button>
        <button id="clearActiveAreaTestButton" class="button button-secondary" type="button">Clear tab</button>
      </div>
      <p id="adminTestingMessage" class="admin-testing-message" hidden></p>
    `;

    const quantityInput = document.getElementById("adminTestQuantity");
    quantityInput.addEventListener("input", () => {
      quantityInput.value = quantityInput.value.replace(/\D/g, "").slice(0, 5);
      setMessage("");
    });
    quantityInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      fillActiveTab();
    });

    document.getElementById("fillActiveAreaButton").addEventListener("click", fillActiveTab);
    document.getElementById("randomActiveAreaButton").addEventListener("click", randomiseActiveTab);
    document.getElementById("clearActiveAreaTestButton").addEventListener("click", clearActiveTab);
  }

  function activeInputs() {
    const areaId = state.activeFloor;
    const sheet = document.getElementById(`${areaId}OrderSheet`);
    return {
      areaId,
      inputs: [...(sheet?.querySelectorAll(".quantity-input[data-product-key]") || [])],
    };
  }

  function fillActiveTab() {
    const input = document.getElementById("adminTestQuantity");
    const quantity = Number(input?.value || 0);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      setMessage("Enter a whole number from 1 to 99,999.", true);
      input?.focus();
      input?.select();
      return;
    }

    const { areaId, inputs } = activeInputs();
    ensureAreaState(areaId);
    inputs.forEach((field) => setProductQuantity(areaId, field, quantity));
    finish(`${inputs.length} products set to ${quantity.toLocaleString("en-AU")}.`);
  }

  function randomiseActiveTab() {
    const { areaId, inputs } = activeInputs();
    ensureAreaState(areaId);
    inputs.forEach((field) => {
      const quantity = RANDOM_QUANTITIES[Math.floor(Math.random() * RANDOM_QUANTITIES.length)];
      setProductQuantity(areaId, field, quantity);
    });
    finish(`${inputs.length} products filled with random test quantities.`);
  }

  function clearActiveTab() {
    const { areaId, inputs } = activeInputs();
    ensureAreaState(areaId);
    state.quantities[areaId].clear();
    state.otherMaterials[areaId] = [];
    inputs.forEach((field) => {
      field.value = "";
      field.classList.remove("has-value");
    });
    if (typeof renderSelectedAdditional === "function") renderSelectedAdditional(areaId);
    finish(`${floorLabels[areaId] || "Active tab"} cleared.`);
  }

  function ensureAreaState(areaId) {
    if (!(state.quantities[areaId] instanceof Map)) state.quantities[areaId] = new Map();
    if (!Array.isArray(state.otherMaterials[areaId])) state.otherMaterials[areaId] = [];
  }

  function setProductQuantity(areaId, field, quantity) {
    const key = String(field.dataset.productKey || "").trim();
    if (!key) return;
    state.quantities[areaId].set(key, quantity);
    field.value = String(quantity);
    field.maxLength = 5;
    field.classList.add("has-value");
  }

  function finish(message) {
    if (typeof renderCounts === "function") renderCounts();
    if (typeof scheduleDraft === "function") scheduleDraft();
    setMessage(message);
  }

  function setMessage(message, error = false) {
    const root = document.getElementById("adminTestingMessage");
    if (!root) return;
    root.hidden = !message;
    root.textContent = message;
    root.classList.toggle("is-error", error);
  }

  function installStyles() {
    if (document.querySelector("style[data-admin-testing-styles='true']")) return;
    const style = document.createElement("style");
    style.dataset.adminTestingStyles = "true";
    style.textContent = `
      .order-form-page .admin-testing-toolbar{display:grid!important;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:14px;margin:0 0 12px;padding:9px 12px;border:1px solid #d2d9d6;background:#fff;box-sizing:border-box}
      .order-form-page .admin-testing-identity{display:grid;grid-template-columns:auto auto;align-items:baseline;column-gap:8px;row-gap:1px;min-width:210px}
      .order-form-page .admin-testing-identity span{grid-column:1/-1;color:#6b7774;font:700 9px/1.2 Inter,system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase}
      .order-form-page .admin-testing-identity strong{font:700 11px/1.25 Inter,system-ui,sans-serif;color:#17211f}
      .order-form-page .admin-testing-identity small{font:600 10px/1.25 Inter,system-ui,sans-serif;color:#6b7774}
      .order-form-page .admin-testing-controls{display:flex;align-items:center;justify-content:flex-end;gap:7px;min-width:0}
      .order-form-page .admin-testing-controls label{margin-right:1px;color:#17211f;font:700 10px/1 Inter,system-ui,sans-serif;white-space:nowrap}
      .order-form-page .admin-testing-controls input{box-sizing:border-box;width:76px;height:34px;margin:0;padding:0 8px;border:1px solid #c8d1ce;border-radius:0;background:#fff;color:#17211f;font:600 11px/1 Inter,system-ui,sans-serif;text-align:center}
      .order-form-page .admin-testing-controls input:focus{outline:0;box-shadow:inset 0 0 0 1px var(--bell-green)}
      .order-form-page .admin-testing-controls .button{min-height:34px;padding:0 11px;font-size:10px;white-space:nowrap}
      .order-form-page .admin-testing-message{grid-column:1/-1;margin:0;padding-top:1px;color:#006557;font:600 10px/1.3 Inter,system-ui,sans-serif}
      .order-form-page .admin-testing-message.is-error{color:#a62b45}
      @media(max-width:900px){.order-form-page .admin-testing-toolbar{grid-template-columns:1fr}.order-form-page .admin-testing-controls{justify-content:flex-start;flex-wrap:wrap}}
    `;
    document.head.append(style);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();