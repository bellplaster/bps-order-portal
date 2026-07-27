(() => {
  const TAB_ROW_SELECTOR = "#deliveryAreaTabs, .products-area > .floor-tabs";
  let tabs = null;
  let observer = null;
  let syncing = false;
  let renameAreaId = "";
  let frame = 0;

  initialise();
  document.addEventListener("DOMContentLoaded", initialise, { once: true });
  window.addEventListener("pageshow", initialise);

  document.addEventListener("dblclick", (event) => {
    const tab = event.target.closest("[data-floor-tab]");
    if (!tab) return;
    renameAreaId = tab.dataset.floorTab || "";
    queueSync();
    window.setTimeout(queueSync, 0);
  }, true);

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-add-area]")) renameAreaId = "";
    if (event.target.closest("[data-floor-tab], [data-add-area], [data-delete-area], .area-tabs-reset")) {
      queueSync();
      window.setTimeout(queueSync, 0);
      window.setTimeout(queueSync, 50);
    }
  }, true);

  document.addEventListener("submit", (event) => {
    if (!event.target.matches(".area-name-editor")) return;
    renameAreaId = "";
    window.setTimeout(queueSync, 0);
  }, true);

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
      observer.observe(tabs, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["class", "aria-selected", "hidden"]
      });
    }

    queueSync();
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
      normaliseAddButton();
      placeRenameEditor();
    } finally {
      observer?.observe(tabs, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["class", "aria-selected", "hidden"]
      });
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

  function placeRenameEditor() {
    const editor = tabs.querySelector(":scope > .area-name-editor");
    if (!editor) return;

    const targetTab = renameAreaId
      ? tabs.querySelector(`:scope > .area-tab-shell [data-floor-tab="${CSS.escape(renameAreaId)}"]`)
      : null;
    const activeTab = tabs.querySelector(':scope > .area-tab-shell [data-floor-tab][aria-selected="true"]')
      || tabs.querySelector(":scope > .area-tab-shell [data-floor-tab].is-active");
    const targetShell = (targetTab || activeTab)?.closest(".area-tab-shell");
    const add = tabs.querySelector(":scope > [data-add-area]");
    const anchor = targetShell || add;

    if (anchor && anchor.nextElementSibling !== editor) {
      anchor.insertAdjacentElement("afterend", editor);
    }

    editor.style.setProperty("position", "static", "important");
    editor.style.setProperty("display", "inline-flex", "important");
    editor.style.setProperty("flex", "0 0 auto", "important");
    editor.style.setProperty("height", "32px", "important");
    editor.style.setProperty("min-height", "32px", "important");
    editor.style.setProperty("margin", "0", "important");
    editor.style.setProperty("transform", "none", "important");
    editor.style.removeProperty("left");
    editor.style.removeProperty("top");
    editor.style.removeProperty("right");
    editor.style.removeProperty("bottom");
  }
})();
