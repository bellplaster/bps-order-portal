(() => {
  loadStyles();
  initialise();
  document.addEventListener("DOMContentLoaded", initialise, { once: true });

  let attempts = 0;
  const retryTimer = window.setInterval(() => {
    attempts += 1;
    alignTabControls();
    if (attempts >= 40 || document.querySelector(".area-tabs-reset")) {
      window.clearInterval(retryTimer);
    }
  }, 100);

  document.addEventListener("click", interceptResetTabs, true);

  function loadStyles() {
    if (document.querySelector('link[data-manager-hotfix="true"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/manager-hotfix.css?v=20260731-1";
    link.dataset.managerHotfix = "true";
    document.head.append(link);
  }

  function initialise() {
    alignTabControls();
  }

  async function interceptResetTabs(event) {
    const button = event.target.closest(".area-tabs-reset");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const confirmed = window.confirm("Delete all tabs? This will remove every product quantity and return to one blank Tab 1.");
    if (!confirmed) return;
    await resetTabs();
  }

  async function resetTabs() {
    if (typeof state === "undefined") return;
    const id = "tab-1";
    state.deliveryAreas = [{ id, label: "Tab 1" }];
    state.activeFloor = id;
    state.quantities = { [id]: new Map() };
    state.otherMaterials = { [id]: [] };
    if (typeof floorLabels !== "undefined") {
      Object.keys(floorLabels).forEach((key) => delete floorLabels[key]);
      floorLabels[id] = "Tab 1";
    }
    if (typeof loadCatalog === "function") await loadCatalog();
    if (typeof renderCounts === "function") renderCounts();
    if (typeof scheduleDraft === "function") scheduleDraft();
    window.setTimeout(alignTabControls, 0);
  }

  function alignTabControls() {
    const tabs = document.getElementById("deliveryAreaTabs") || document.querySelector(".floor-tabs");
    if (!tabs) return;
    const summary = tabs.querySelector(".area-tab-summary");
    if (summary) tabs.append(summary);
  }
})();