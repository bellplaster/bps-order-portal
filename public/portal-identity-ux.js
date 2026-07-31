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
    }

    const header = document.querySelector(".portal-header");
    const brand = header?.querySelector(".brand-link");
    if (!header || !brand) return true;

    let identity = header.querySelector(".portal-customer-identity");
    if (!identity) {
      identity = document.createElement("div");
      identity.className = "portal-customer-identity";
      header.insertBefore(identity, brand);
    }
    identity.textContent = name;
    identity.setAttribute("title", name);

    header.querySelectorAll(".portal-customer-identity").forEach((node) => {
      if (node !== identity) node.remove();
    });
    return true;
  }

  function installStyles() {
    if (document.getElementById("portal-customer-identity-styles")) return;
    const style = document.createElement("style");
    style.id = "portal-customer-identity-styles";
    style.textContent = `
      .portal-header{position:relative}
      .portal-customer-identity{min-width:0;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#17211f;font-size:12px;font-weight:650;line-height:1.2;text-transform:none}
      @media(max-width:760px){.portal-customer-identity{max-width:120px;font-size:10px}}
    `;
    document.head.append(style);
  }

  function start() {
    installStyles();
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
