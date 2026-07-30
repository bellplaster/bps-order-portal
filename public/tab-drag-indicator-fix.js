(() => {
  if (document.getElementById("tab-drag-indicator-fix")) return;

  const style = document.createElement("style");
  style.id = "tab-drag-indicator-fix";
  style.textContent = `
    .area-tab-shell.is-dragging {
      border-color: transparent !important;
      box-shadow: none !important;
    }

    .area-tab-shell.drop-before {
      border-left: 3px solid var(--bell-green, #006557) !important;
      box-shadow: none !important;
    }

    .area-tab-shell.drop-after {
      border-right: 3px solid var(--bell-green, #006557) !important;
      box-shadow: none !important;
    }
  `;
  document.head.append(style);
})();
