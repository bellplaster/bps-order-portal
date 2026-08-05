(() => {
  const params = new URLSearchParams(window.location.search);
  const submissionId = String(params.get("viewOrder") || "").trim();
  if (!submissionId || !document.body.classList.contains("order-form-page")) return;

  globalThis.BPS_ORDER_READONLY = Object.freeze({ submissionId });

  const originalLoadCatalog = loadCatalog;
  const originalClearDraft = typeof clearDraft === "function" ? clearDraft : null;
  const originalScheduleDraft = typeof scheduleDraft === "function" ? scheduleDraft : null;

  clearDraft = function clearReadOnlyDraft() {};
  scheduleDraft = function scheduleReadOnlyDraft() {};

  loadCatalog = async function loadReadOnlyOrderSnapshot() {
    await originalLoadCatalog();

    const result = await fetchJson(`/api/orders/${encodeURIComponent(submissionId)}`);
    const snapshot = result?.snapshot || {};
    if (!result?.payload || !snapshot?.layout) {
      throw new Error("The submitted order snapshot is unavailable.");
    }

    state.readOnlyOrder = result;
    state.layout = snapshot.layout;
    state.editingOrder = null;
    applyPayload(result.payload);
    setValue("customerName", result.order?.companyName || result.payload.customer || "");
    const summary = document.getElementById("accountSummary");
    if (summary) {
      summary.hidden = false;
      summary.textContent = [result.order?.companyName, result.order?.debtorCode].filter(Boolean).join(" · ");
    }
    enterReadOnlyMode(result);
  };

  function enterReadOnlyMode(result) {
    document.body.classList.add("order-readonly-page");
    document.title = `${result.order?.customerReference || "Order"} | Read-only order`;

    const form = document.getElementById("orderForm");
    if (!(form instanceof HTMLFormElement)) return;
    form.dataset.orderMode = "readonly";
    form.setAttribute("aria-label", "Read-only submitted order");
    form.addEventListener("submit", preventMutation, true);
    form.addEventListener("input", preventMutation, true);
    form.addEventListener("change", preventMutation, true);

    installReadOnlyBanner(result);
    hideMutationControls();
    lockFormControls(form);
    lockDeliveryAreas();
    announceLegacyLayout(result.snapshot);

    if (typeof updateGeneratedDeliverySummary === "function") updateGeneratedDeliverySummary();
    if (typeof renderCounts === "function") renderCounts();
  }

  function installReadOnlyBanner(result) {
    const form = document.getElementById("orderForm");
    if (!form || document.getElementById("readOnlyOrderBanner")) return;

    const banner = document.createElement("section");
    banner.id = "readOnlyOrderBanner";
    banner.className = "read-only-order-banner";
    const identity = document.createElement("div");
    identity.innerHTML = `
      <strong>Read-only order snapshot</strong>
      <span>Order ${escapeHtml(result.order?.customerReference || "")} is shown exactly as submitted and cannot be changed.</span>`;
    const back = document.createElement("a");
    back.href = `/orders/view/?id=${encodeURIComponent(submissionId)}`;
    back.textContent = "Back to order";
    banner.append(identity, back);
    form.before(banner);
  }

  function hideMutationControls() {
    [
      ".two-step-nav",
      "#adminOrderTools",
      "#editModeBanner",
      ".form-actions",
      ".area-tab-add",
      ".area-tab-delete",
      ".additional-search",
      ".additional-products-heading",
      "#clearAddressButton",
      "#futureDateConfirmation",
      "[data-linked-contact-picker]",
      ".contact-picker-button",
      ".saved-contact-picker-button",
    ].forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        element.hidden = true;
        element.setAttribute("aria-hidden", "true");
      });
    });

    document.querySelectorAll('[data-step]:not([data-step="form"])').forEach((panel) => {
      panel.hidden = true;
      panel.classList.remove("is-active");
    });
    const formPanel = document.querySelector('[data-step="form"]');
    if (formPanel) {
      formPanel.hidden = false;
      formPanel.classList.add("is-active");
    }
  }

  function lockFormControls(form) {
    form.querySelectorAll("input, select, textarea").forEach((control) => {
      control.disabled = true;
      control.setAttribute("aria-readonly", "true");
      control.tabIndex = -1;
    });

    form.querySelectorAll("button").forEach((button) => {
      if (button.matches("[data-floor-tab]")) return;
      button.disabled = true;
      button.tabIndex = -1;
    });
  }

  function lockDeliveryAreas() {
    document.querySelectorAll(".area-tab-shell").forEach((shell) => {
      shell.draggable = false;
      shell.removeAttribute("title");
    });
    document.querySelectorAll("[data-floor-tab]").forEach((tab) => {
      tab.title = "View submitted delivery area";
      tab.removeAttribute("aria-disabled");
    });
  }

  function announceLegacyLayout(snapshot) {
    if (snapshot?.layoutSource !== "current") return;
    const banner = document.getElementById("readOnlyOrderBanner");
    const note = document.createElement("small");
    note.textContent = "This older order predates layout snapshots, so its quantities are positioned using the current product grid.";
    banner?.querySelector("div")?.append(note);
  }

  function preventMutation(event) {
    if (event.target?.matches?.("[data-floor-tab]")) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  window.addEventListener("pagehide", () => {
    if (originalClearDraft) clearDraft = originalClearDraft;
    if (originalScheduleDraft) scheduleDraft = originalScheduleDraft;
  }, { once:true });

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);
  }
})();
