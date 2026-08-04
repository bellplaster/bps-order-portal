(() => {
  if (window.__bpsAccountInteractionPolishStarted) return;
  window.__bpsAccountInteractionPolishStarted = true;

  const messageReplacements = new Map([
    ["Saved address added.", "Address saved"],
    ["Saved address updated.", "Address updated"],
    ["Default saved address updated.", "Default address updated"],
    ["Saved address removed.", "Address removed"],
  ]);

  const navIcons = {
    profile: `
      <span class="account-nav-icon" aria-hidden="true">
        <svg viewBox="0 0 11 16" focusable="false">
          <path fill="currentColor" d="M5.5 2.9019a4.7308 4.7308 0 1 0 4.7308 4.7308A4.7309 4.7309 0 0 0 5.5 2.9019Zm2.88 7.2608A3.8983 3.8983 0 0 0 5.5 9.165a3.8983 3.8983 0 0 0-2.88.9977 3.8435 3.8435 0 1 1 6.7306-2.53A3.8184 3.8184 0 0 1 8.38 10.1627ZM7.1051 6.71A1.649 1.649 0 0 1 5.5 8.4 1.649 1.649 0 0 1 3.8949 6.71 1.6489 1.6489 0 0 1 5.5 5.0206 1.6489 1.6489 0 0 1 7.1051 6.71Z"/>
        </svg>
      </span>`,
    defaults: `
      <span class="account-nav-icon" aria-hidden="true">
        <svg viewBox="0 0 11 16" focusable="false">
          <path fill="currentColor" d="M7.0991 2.4238H3.9009a1.5916 1.5916 0 0 0-1.59 1.59v7.8076a.5906.5906 0 0 0 .13.4014.4553.4553 0 0 0 .3618.1533.5028.5028 0 0 0 .2989-.1006 3.2911 3.2911 0 0 0 .372-.33L5.499 9.94l2.0279 2.0058a4.1346 4.1346 0 0 0 .3681.3272.495.495 0 0 0 .3023.1035.4558.4558 0 0 0 .3613-.1524.5923.5923 0 0 0 .13-.4023V4.0137A1.5916 1.5916 0 0 0 7.0991 2.4238ZM3.1265 3.9287a.7755.7755 0 0 1 .7744-.7754H7.0991a.7755.7755 0 0 1 .7744.7754v7.1279L6.0718 9.2734a.8155.8155 0 0 0-1.1441 0L3.1265 11.0576Z"/>
        </svg>
      </span>`,
    contacts: `
      <span class="account-nav-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path fill="currentColor" d="M5 2.75h14A2.25 2.25 0 0 1 21.25 5v14A2.25 2.25 0 0 1 19 21.25H5A2.25 2.25 0 0 1 2.75 19V5A2.25 2.25 0 0 1 5 2.75Zm0 1.5A.75.75 0 0 0 4.25 5v14c0 .414.336.75.75.75h14a.75.75 0 0 0 .75-.75V5a.75.75 0 0 0-.75-.75ZM12 7.5a2.75 2.75 0 1 1 0 5.5 2.75 2.75 0 0 1 0-5.5ZM12 9a1.25 1.25 0 1 0 0 2.5A1.25 1.25 0 0 0 12 9Zm0 5.25c2.407 0 4.25 1.627 4.25 3.5a.75.75 0 0 1-1.5 0c0-1.012-1.176-2-2.75-2s-2.75.988-2.75 2a.75.75 0 0 1-1.5 0c0-1.873 1.843-3.5 4.25-3.5Z"/>
        </svg>
      </span>`,
    addresses: `
      <span class="account-nav-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path fill="currentColor" d="m12 3.8 7.7 6.9a.75.75 0 1 1-1 1.1l-.95-.86V19a2 2 0 0 1-2 2h-7.5a2 2 0 0 1-2-2v-8.06l-.95.86a.75.75 0 1 1-1-1.1Zm4.25 6.15L12 6.13 7.75 9.95V19a.5.5 0 0 0 .5.5h.5v-4.75A1.75 1.75 0 0 1 10.5 13h3a1.75 1.75 0 0 1 1.75 1.75v4.75h.5a.5.5 0 0 0 .5-.5Zm-3 9.55v-4.75a.25.25 0 0 0-.25-.25h-2a.25.25 0 0 0-.25.25v4.75Z"/>
        </svg>
      </span>`,
    admin: `
      <span class="account-nav-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path fill="currentColor" d="M5.25 3.75h4.5v4.5h-4.5Zm1.5 1.5v1.5h1.5v-1.5Zm7.5-1.5h4.5v4.5h-4.5Zm1.5 1.5v1.5h1.5v-1.5Zm-10.5 10.5h4.5v4.5h-4.5Zm1.5 1.5v1.5h1.5v-1.5Zm7.5-1.5h4.5v4.5h-4.5Zm1.5 1.5v1.5h1.5v-1.5Z"/>
        </svg>
      </span>`,
    security: `
      <span class="account-nav-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path fill="currentColor" d="M8.75 10V7.75A3.25 3.25 0 0 1 12 4.5a3.25 3.25 0 0 1 3.25 3.25V10H16a2.25 2.25 0 0 1 2.25 2.25v5.5A2.25 2.25 0 0 1 16 20H8a2.25 2.25 0 0 1-2.25-2.25v-5.5A2.25 2.25 0 0 1 8 10Zm1.5 0h3.5V7.75A1.75 1.75 0 0 0 12 6a1.75 1.75 0 0 0-1.75 1.75ZM8 11.5a.75.75 0 0 0-.75.75v5.5c0 .414.336.75.75.75h8a.75.75 0 0 0 .75-.75v-5.5a.75.75 0 0 0-.75-.75Z"/>
        </svg>
      </span>`,
  };

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

  function installNavIcons() {
    const links = document.querySelectorAll(".account-nav-v2 a[data-account-nav]");
    if (!links.length) return false;

    links.forEach((link) => {
      const key = link.dataset.accountNav;
      const icon = navIcons[key];
      if (!icon || link.dataset.navIconInstalled === "true") return;
      const label = (link.textContent || "").trim();
      link.innerHTML = `${icon}<span class="account-nav-label">${label}</span>`;
      link.dataset.navIconInstalled = "true";
    });
    return true;
  }

  function scheduleNavIcons() {
    if (installNavIcons()) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (installNavIcons() || attempts >= 50) window.clearInterval(timer);
    }, 100);
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
    scheduleNavIcons();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
