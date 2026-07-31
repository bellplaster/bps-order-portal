(() => {
  if (!document.body.classList.contains("order-form-page")) return;
  if (window.__bpsPortalIdentityUxStarted) return;
  window.__bpsPortalIdentityUxStarted = true;

  let observer = null;
  let applying = false;

  function companyName() {
    try {
      return String(state?.account?.companyName || "").trim();
    } catch (_error) {
      return "";
    }
  }

  function apply() {
    const name = companyName();
    if (!name) return false;

    const summary = document.getElementById("accountSummary");
    if (summary && summary.textContent !== name) {
      applying = true;
      summary.textContent = name;
      summary.setAttribute("aria-label", `Signed in as ${name}`);
      summary.setAttribute("title", name);
      applying = false;
    }

    document.querySelectorAll(".portal-customer-identity").forEach((node) => node.remove());
    return true;
  }

  function watchSummary() {
    const summary = document.getElementById("accountSummary");
    if (!summary || observer) return;
    observer = new MutationObserver(() => {
      if (!applying) apply();
    });
    observer.observe(summary, { childList: true, characterData: true, subtree: true });
  }

  function start() {
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (apply()) watchSummary();
      if ((observer && attempts >= 10) || attempts >= 80) window.clearInterval(timer);
    }, 100);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
