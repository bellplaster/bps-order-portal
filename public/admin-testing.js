(() => {
  const MAX_QUANTITY = 99999;
  const RANDOM_QUANTITIES = [1, 2, 5, 10, 25, 50, 100, 250, 500, 999, 5000, 10000, 50000, 99999];
  let initialised = false;

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
    tools.className = "admin-order-tools admin-testing-toolbar";
    tools.innerHTML = `
      <div class="admin-testing-identity">
        <span>Admin testing</span>
        <strong>${escapeHtml(company)}</strong>
        <small>Debtor ${escapeHtml(debtor)}</small>
      </div>
      <div class="admin-testing-controls">
        <label for="adminTestQuantity"><span>Fill active tab</span></label>
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

    syncVisibility();
    const observer = new MutationObserver(syncVisibility);
    document.querySelectorAll("[data-step]").forEach((panel) => {
      observer.observe(panel, { attributes: true, attributeFilter: ["hidden", "class"] });
    });
  }

  function syncVisibility() {
    const tools = document.getElementById("adminOrderTools");
    if (!tools) return;
    const formPanel = document.querySelector('[data-step="form"]');
    const formActive = state.activeStep === "form" && formPanel && !formPanel.hidden;
    tools.hidden = !formActive;
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

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();