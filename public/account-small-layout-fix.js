(() => {
  if (window.__bpsAccountSmallLayoutFixStarted) return;
  window.__bpsAccountSmallLayoutFixStarted = true;

  function apply() {
    const brand = document.querySelector(".account-sidebar-brand-v2");
    if (!(brand instanceof HTMLElement)) return false;

    const heading = brand.querySelector("strong");
    if (heading) heading.textContent = "Accounts";
    brand.querySelector("span")?.remove();
    brand.dataset.accountsHeading = "true";
    return true;
  }

  function start() {
    if (apply()) return;

    const observer = new MutationObserver(() => {
      if (apply()) observer.disconnect();
    });
    observer.observe(document.body, { childList:true, subtree:true });

    window.setTimeout(() => observer.disconnect(), 10000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once:true });
  else start();
})();
