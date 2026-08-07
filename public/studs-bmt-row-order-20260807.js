(() => {
  if (globalThis.__bpsStudsBmtRowOrder20260807) return;
  globalThis.__bpsStudsBmtRowOrder20260807 = true;

  function studWidth(row) {
    const label = String(row?.querySelector("th")?.textContent || "");
    return Number.parseInt(label.match(/^\s*(\d+)\s*mm\s+Stud/i)?.[1] || "9999", 10);
  }

  function sortStudRows(root = document) {
    root.querySelectorAll?.(".studs-bmt-table tbody").forEach((tbody) => {
      const header = tbody.querySelector(".lower-matrix-header");
      const rows = [...tbody.children].filter((row) => row !== header);
      rows.sort((rowA, rowB) => studWidth(rowA) - studWidth(rowB));
      rows.forEach((row) => tbody.append(row));
    });
  }

  let queued = false;
  function queueSort() {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      sortStudRows();
    });
  }

  function initialise() {
    sortStudRows();
    const root = document.querySelector(".floor-panels");
    if (!root || root.dataset.studsBmtRowOrderObserved === "true") return;
    root.dataset.studsBmtRowOrderObserved = "true";
    new MutationObserver((mutations) => {
      const changed = mutations.some((mutation) => [...mutation.addedNodes].some((node) =>
        node instanceof Element && (node.matches?.(".studs-bmt-section") || node.querySelector?.(".studs-bmt-section")),
      ));
      if (changed) queueSort();
    }).observe(root, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialise, { once: true });
  else initialise();
})();
