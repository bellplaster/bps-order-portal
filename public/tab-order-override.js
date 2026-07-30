(() => {
  const TAB_ROW_SELECTOR = "#deliveryAreaTabs, .products-area > .floor-tabs";
  let tabs = null;
  let observer = null;
  let frame = 0;

  initialise();
  document.addEventListener("DOMContentLoaded", initialise, { once: true });
  window.addEventListener("pageshow", initialise);

  function initialise() {
    const nextTabs = document.querySelector(TAB_ROW_SELECTOR);
    if (!nextTabs) {
      window.setTimeout(initialise, 50);
      return;
    }

    if (tabs !== nextTabs) {
      observer?.disconnect();
      tabs = nextTabs;
      observer = new MutationObserver(queueSync);
      observer.observe(tabs, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "aria-selected", "hidden", "draggable"],
      });
    }

    queueSync();
  }

  function queueSync() {
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(syncOrder);
  }

  function syncOrder() {
    const current = document.querySelector(TAB_ROW_SELECTOR);
    if (!current) return;
    if (current !== tabs) {
      tabs = current;
      initialise();
      return;
    }

    const areas = typeof state !== "undefined" && Array.isArray(state.deliveryAreas)
      ? state.deliveryAreas
      : [];
    const orderById = new Map(areas.map((area, index) => [String(area.id), (index + 1) * 10]));

    [...tabs.querySelectorAll(":scope > .area-tab-shell[data-area-id]")].forEach((shell, index) => {
      const order = orderById.get(shell.dataset.areaId || "") || (index + 1) * 10;
      shell.style.setProperty("order", String(order), "important");
      shell.setAttribute("draggable", "true");
    });

    const editor = tabs.querySelector(":scope > .area-name-editor");
    if (editor) {
      const targetId = editor.dataset.targetAreaId
        || (typeof state !== "undefined" ? String(state.activeFloor || "") : "");
      const order = (orderById.get(targetId) || 0) + 1;
      editor.style.setProperty("order", String(order), "important");
    }

    tabs.querySelector(":scope > [data-add-area]")?.style.setProperty("order", "10000", "important");
    tabs.querySelector(":scope > .area-tabs-reset")?.style.setProperty("order", "10010", "important");

    const summary = tabs.querySelector(":scope > .area-tab-summary");
    if (summary) {
      summary.style.setProperty("order", "10020", "important");
      summary.style.setProperty("display", "none", "important");
    }
  }
})();