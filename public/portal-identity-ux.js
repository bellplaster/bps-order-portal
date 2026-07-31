(() => {
  if (!document.body.classList.contains("order-form-page")) return;
  if (window.__bpsPortalIdentityUxStarted) return;
  window.__bpsPortalIdentityUxStarted = true;

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
    if (summary) {
      summary.textContent = name;
      summary.setAttribute("aria-label", `Signed in as ${name}`);
      summary.setAttribute("title", name);
    }

    document.querySelectorAll(".portal-customer-identity").forEach((node) => node.remove());
    return true;
  }

  function start() {
    if (apply()) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (apply() || attempts >= 50) window.clearInterval(timer);
    }, 100);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
