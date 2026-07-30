(() => {
  if (document.getElementById("tab-drag-indicator-fix")) return;

  removeLegacyDragIndicatorRules();

  const style = document.createElement("style");
  style.id = "tab-drag-indicator-fix";
  style.textContent = `
    #deliveryAreaTabs:has(> .area-tab-shell.is-dragging) > .area-tab-shell,
    .products-area > .floor-tabs:has(> .area-tab-shell.is-dragging) > .area-tab-shell {
      border-left-color: transparent !important;
      border-right-color: transparent !important;
      box-shadow: none !important;
      outline: 0 !important;
    }

    #deliveryAreaTabs > .area-tab-shell.is-dragging,
    .products-area > .floor-tabs > .area-tab-shell.is-dragging {
      border-color: transparent !important;
      box-shadow: none !important;
      outline: 0 !important;
    }

    #deliveryAreaTabs:has(> .area-tab-shell.is-dragging) > .area-tab-shell.drop-before,
    .products-area > .floor-tabs:has(> .area-tab-shell.is-dragging) > .area-tab-shell.drop-before {
      border-left: 3px solid var(--bell-green, #006557) !important;
      box-shadow: none !important;
      outline: 0 !important;
    }

    #deliveryAreaTabs:has(> .area-tab-shell.is-dragging) > .area-tab-shell.drop-after,
    .products-area > .floor-tabs:has(> .area-tab-shell.is-dragging) > .area-tab-shell.drop-after {
      border-right: 3px solid var(--bell-green, #006557) !important;
      box-shadow: none !important;
      outline: 0 !important;
    }
  `;
  document.head.append(style);

  function removeLegacyDragIndicatorRules() {
    document.querySelectorAll("style").forEach((legacyStyle) => {
      if (legacyStyle.id === "tab-drag-indicator-fix") return;
      const sheet = legacyStyle.sheet;
      if (!sheet) return;
      try {
        for (let index = sheet.cssRules.length - 1; index >= 0; index -= 1) {
          const selector = sheet.cssRules[index]?.selectorText || "";
          if (selector.includes(".area-tab-shell.drop-before") || selector.includes(".area-tab-shell.drop-after")) {
            sheet.deleteRule(index);
          }
        }
      } catch (_error) {
        // Ignore inaccessible style sheets; injected same-page tab styles remain removable.
      }
    });
  }
})();