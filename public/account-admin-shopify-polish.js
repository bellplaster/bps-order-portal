(() => {
  if (window.__bpsAccountAdminShopifyPolishStarted) return;
  window.__bpsAccountAdminShopifyPolishStarted = true;

  const selectPrompts = new Map([
    ["defaultTimeSlot", "Select time slot"],
    ["defaultDeliveryType", "Select delivery type"],
  ]);

  function ensureTimeSlotOptions(select) {
    if (select.id !== "defaultTimeSlot") return;
    if (![...select.options].some((option) => option.value === "ANY")) {
      select.append(new Option("Any", "ANY"));
    }
  }

  function syncSelect(select) {
    if (!(select instanceof HTMLSelectElement)) return;
    const prompt = selectPrompts.get(select.id);
    if (!prompt) return;

    ensureTimeSlotOptions(select);
    const emptyOption = [...select.options].find((option) => option.value === "");
    if (emptyOption) {
      emptyOption.textContent = emptyOption.dataset.originalText || prompt;
      emptyOption.dataset.originalText = prompt;
      emptyOption.disabled = false;
    }

    const field = select.closest(".account-shopify-field");
    if (field) field.classList.toggle("is-select-empty", !String(select.value || "").trim());
  }

  function installSelectPrompts(root = document) {
    selectPrompts.forEach((_prompt, id) => {
      const select = root instanceof Element && root.id === id ? root : root.querySelector?.(`#${id}`);
      if (!(select instanceof HTMLSelectElement)) return;
      if (select.dataset.accountPromptInstalled !== "true") {
        select.dataset.accountPromptInstalled = "true";
        select.addEventListener("input", () => syncSelect(select));
        select.addEventListener("change", () => syncSelect(select));
      }
      syncSelect(select);
    });
  }

  function installAdminToolsIcon() {
    const link = document.querySelector('.account-nav-v2 a[data-account-nav="admin"]');
    if (!(link instanceof HTMLAnchorElement)) return false;
    if (link.dataset.adminToolsInstalled === "true") return true;

    const label = link.querySelector(".account-nav-label")?.textContent?.trim()
      || (link.textContent || "Administration").trim()
      || "Administration";
    link.innerHTML = `<span class="account-nav-icon account-nav-admin-tools" aria-hidden="true"></span><span class="account-nav-label">${escapeHtml(label)}</span>`;
    link.dataset.adminToolsInstalled = "true";
    link.dataset.navIconInstalled = "true";
    return true;
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);
  }

  function scan(root = document) {
    installSelectPrompts(root);
    installAdminToolsIcon();
  }

  function start() {
    scan();
    [
      "bps:account-loaded",
      "bps:account-addresses-ready",
      "bps:account-contacts-ready",
    ].forEach((eventName) => document.addEventListener(eventName, () => scan()));

    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (node instanceof Element) scan(node);
        });
      });
    });
    observer.observe(document.body, { childList:true, subtree:true });

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      scan();
      if (attempts >= 50 && installAdminToolsIcon()) window.clearInterval(timer);
    }, 100);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once:true });
  else start();
})();
