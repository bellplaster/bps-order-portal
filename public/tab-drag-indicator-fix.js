(() => {
  if (document.getElementById("tab-drag-indicator-fix")) return;

  const style = document.createElement("style");
  style.id = "tab-drag-indicator-fix";
  style.textContent = `
    #deliveryAreaTabs > .area-tab-shell.is-dragging,
    .products-area > .floor-tabs > .area-tab-shell.is-dragging {
      border-color: transparent !important;
      box-shadow: none !important;
      outline: 0 !important;
    }

    #deliveryAreaTabs > .area-tab-shell.drop-before,
    .products-area > .floor-tabs > .area-tab-shell.drop-before {
      border-left: 3px solid var(--bell-green, #006557) !important;
      box-shadow: none !important;
      outline: 0 !important;
    }

    #deliveryAreaTabs > .area-tab-shell:has(+ .area-tab-shell.drop-before),
    .products-area > .floor-tabs > .area-tab-shell:has(+ .area-tab-shell.drop-before) {
      border-right-color: transparent !important;
      box-shadow: none !important;
    }

    #deliveryAreaTabs > .area-tab-shell.drop-after,
    .products-area > .floor-tabs > .area-tab-shell.drop-after {
      border-right: 3px solid var(--bell-green, #006557) !important;
      box-shadow: none !important;
      outline: 0 !important;
    }

    #deliveryAreaTabs > .area-tab-shell.drop-after + .area-tab-shell,
    .products-area > .floor-tabs > .area-tab-shell.drop-after + .area-tab-shell {
      border-left-color: transparent !important;
      box-shadow: none !important;
    }
  `;
  document.head.append(style);
})();