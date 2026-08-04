(() => {
  if (window.__bpsAccountInteractionPolishStarted) return;
  window.__bpsAccountInteractionPolishStarted = true;

  const messageReplacements = new Map([
    ["Saved address added.", "Address saved"],
    ["Saved address updated.", "Address updated"],
    ["Default saved address updated.", "Default address updated"],
    ["Saved address removed.", "Address removed"],
  ]);

  let toastTimer = 0;
  let normalisingMessage = false;

  function prefersReducedMotion() {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  }

  function accountHeaderOffset() {
    const header = document.querySelector(".portal-header");
    const headerHeight = header?.getBoundingClientRect().height || 72;
    return Math.ceil(headerHeight + 20);
  }

  function scrollToAccountSection(target) {
    if (!(target instanceof Element)) return;
    const top = Math.max(0, window.scrollY + target.getBoundingClientRect().top - accountHeaderOffset());
    window.scrollTo({
      top,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }

  function handleAccountNavigation(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const origin = event.target instanceof Element ? event.target : event.target?.parentElement;
    const link = origin?.closest?.(".account-nav-v2 a[href^='#']");
    if (!link) return;

    const hash = link.getAttribute("href") || "";
    const id = hash.startsWith("#") ? hash.slice(1) : "";
    const target = id ? document.getElementById(id) : null;
    if (!target) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    history.replaceState(history.state, "", hash);
    document.querySelectorAll(".account-nav-v2 a").forEach((item) => {
      item.classList.toggle("is-active", item === link);
    });
    scrollToAccountSection(target);
  }

  function hideToast(root) {
    window.clearTimeout(toastTimer);
    toastTimer = 0;
    root.hidden = true;
    root.removeAttribute("data-account-toast");
    root.removeAttribute("title");
  }

  function syncToast(root) {
    if (normalisingMessage || root.hidden) return;
    const current = (root.textContent || "").trim();
    if (!current) return;

    const replacement = messageReplacements.get(current);
    if (replacement && replacement !== current) {
      normalisingMessage = true;
      root.textContent = replacement;
      normalisingMessage = false;
    }

    const isError = root.classList.contains("is-error");
    root.dataset.accountToast = "true";
    root.setAttribute("role", isError ? "alert" : "status");
    root.setAttribute("aria-live", isError ? "assertive" : "polite");
    root.setAttribute("title", "Dismiss notification");

    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => hideToast(root), isError ? 7500 : 4000);
  }

  function installToast() {
    const root = document.getElementById("accountMessage");
    if (!root || root.dataset.accountToastInstalled === "true") return;
    root.dataset.accountToastInstalled = "true";
    root.addEventListener("click", () => hideToast(root));

    const observer = new MutationObserver(() => queueMicrotask(() => syncToast(root)));
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["hidden", "class"],
      childList: true,
      characterData: true,
      subtree: true,
    });
    syncToast(root);
  }

  function start() {
    document.addEventListener("click", handleAccountNavigation, true);
    installToast();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
