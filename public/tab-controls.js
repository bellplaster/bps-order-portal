(() => {
  const TAB_ROW_SELECTOR = "#deliveryAreaTabs, .products-area > .floor-tabs";
  let tabs = null;
  let observer = null;
  let syncing = false;
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
      tabs.dataset.managerObserved = "true";
      tabs.dataset.consolidatedTabControls = "true";
      observer = new MutationObserver(() => {
        if (!syncing) queueSync();
      });
      observeTabs();
    }

    queueSync();
  }

  function observeTabs() {
    observer?.observe(tabs, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "aria-selected", "hidden", "draggable"]
    });
  }

  function queueSync() {
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(syncControls);
  }

  function syncControls() {
    if (!tabs || syncing) return;
    syncing = true;
    observer?.disconnect();

    try {
      tabs.querySelectorAll(":scope > .area-tab-summary").forEach((summary) => summary.remove());
      normaliseAddButton();
    } finally {
      observeTabs();
      syncing = false;
    }
  }

  function normaliseAddButton() {
    const add = tabs.querySelector(":scope > [data-add-area]");
    if (!add) return;

    if (add.childNodes.length !== 1 || add.textContent !== "+") {
      add.replaceChildren(document.createTextNode("+"));
    }

    add.classList.add("area-tab-add");
    add.setAttribute("aria-label", "Add tab");
    add.setAttribute("title", "Add tab");

    const rules = {
      display: "grid",
      placeItems: "center",
      flex: "0 0 32px",
      width: "32px",
      minWidth: "32px",
      maxWidth: "32px",
      height: "32px",
      minHeight: "32px",
      maxHeight: "32px",
      margin: "0",
      padding: "0",
      overflow: "hidden",
      boxSizing: "border-box",
      fontSize: "18px",
      fontWeight: "600",
      lineHeight: "1",
      textIndent: "0",
      whiteSpace: "nowrap"
    };

    Object.entries(rules).forEach(([property, value]) => {
      add.style.setProperty(property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`), value, "important");
    });
  }
})();