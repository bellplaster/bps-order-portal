(() => {
  const replacements = [
    ["Primary user", "Account supervisor"],
    ["Standard user", "Order user"],
    ["Primary", "Supervisor"],
  ];

  function replaceTextNode(node) {
    if (!(node instanceof Text)) return;
    const value = node.nodeValue || "";
    let next = value;
    replacements.forEach(([source, replacement]) => {
      next = next.split(source).join(replacement);
    });
    if (next !== value) node.nodeValue = next;
  }

  function patchRoleLabels(root = document) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(replaceTextNode);

    root.querySelectorAll?.("option").forEach((option) => {
      if (option.textContent === "Primary user") option.textContent = "Account supervisor";
      if (option.textContent === "Standard user") option.textContent = "Order user";
    });

    const note = document.getElementById("managePortalUserNote");
    if (note) note.textContent = "Account supervisors can view every order submitted under this debtor account. Order users can view only orders submitted with their own login. Submitted orders are permanent and read-only.";

    const primarySelect = document.getElementById("managePrimary");
    const primaryLabel = primarySelect?.closest("label")?.querySelector("span");
    if (primaryLabel) primaryLabel.textContent = "Order visibility";

    const createPrimary = document.getElementById("newUserPrimary");
    const createLabel = createPrimary?.closest("label")?.querySelector("span");
    if (createLabel) createLabel.textContent = "Order visibility";
  }

  function installHelp() {
    const panel = document.querySelector('[data-admin-panel="users"] .admin-panel-title');
    if (!panel || document.getElementById("portal-role-help")) return;
    const help = document.createElement("p");
    help.id = "portal-role-help";
    help.className = "portal-role-help";
    help.textContent = "Account supervisors see all orders for their debtor account. Order users see only their own submissions.";
    panel.append(help);
  }

  function clearAdminOnlyMessage() {
    const message = document.getElementById("accountMessage");
    if (!message) return;
    if (/administrator access required/i.test(message.textContent || "")) {
      message.textContent = "";
      message.hidden = true;
      message.className = "portal-message";
    }
  }

  async function simplifyCustomerAccount() {
    let result;
    try {
      const response = await fetch("/api/account", { credentials: "same-origin", headers: { Accept: "application/json" } });
      result = await response.json();
    } catch (_error) {
      return;
    }

    const profile = result?.profile;
    if (!profile || profile.role === "admin") return;

    document.getElementById("customerAccountCard")?.setAttribute("hidden", "");
    const companyInput = document.getElementById("companyName");
    if (companyInput) {
      companyInput.readOnly = true;
      companyInput.disabled = true;
    }

    const heading = document.querySelector(".account-heading h1");
    const copy = document.querySelector(".account-heading p");
    if (heading) heading.textContent = "Account";
    if (copy) copy.textContent = "Manage order defaults and sign-in security.";

    clearAdminOnlyMessage();
    window.setTimeout(clearAdminOnlyMessage, 250);
    window.setTimeout(clearAdminOnlyMessage, 1000);
  }

  function installStyles() {
    if (document.getElementById("account-role-ux-styles")) return;
    const style = document.createElement("style");
    style.id = "account-role-ux-styles";
    style.textContent = `
      .portal-role-help{margin:4px 0 0;max-width:680px;color:#687471;font-size:10px;line-height:1.45}
      .portal-user-role{font-weight:500}
      #customerAccountCard[hidden]{display:none!important}
    `;
    document.head.append(style);
  }

  function install() {
    if (!document.body.classList.contains("account-page")) return;
    installStyles();
    installHelp();
    patchRoleLabels();
    void simplifyCustomerAccount();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) patchRoleLabels(node);
        else replaceTextNode(node);
      }));
      installHelp();
      clearAdminOnlyMessage();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
