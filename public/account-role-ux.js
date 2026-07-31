(() => {
  const replacements = [
    ["Primary user", "Account supervisor"],
    ["Standard user", "Order user"],
    ["No saved contact", "No contact details"],
    ["Primary", "Supervisor"],
  ];

  function replaceTextNode(node) {
    if (!(node instanceof Text)) return;
    const value = node.nodeValue || "";
    let next = value;
    replacements.forEach(([source, replacement]) => { next = next.split(source).join(replacement); });
    if (next !== value) node.nodeValue = next;
  }

  function relabelField(id, text) {
    const field = document.getElementById(id);
    const label = field?.closest("label")?.querySelector("span");
    if (label) label.textContent = text;
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
    if (note) note.textContent = "Account supervisors can view every order under this debtor account. Order users see only their own submissions. These user contact details are separate from the account's shared saved contacts.";

    relabelField("managePrimary", "Order visibility");
    relabelField("newUserPrimary", "Order visibility");
    relabelField("manageContactName", "User contact name");
    relabelField("manageMobile", "User phone");
    relabelField("newUserContactName", "User contact name");
    relabelField("newUserMobile", "User phone");
  }

  function installHelp() {
    const panel = document.querySelector('[data-admin-panel="users"] .admin-panel-title');
    if (!panel || document.getElementById("portal-role-help")) return;
    const help = document.createElement("p");
    help.id = "portal-role-help";
    help.className = "portal-role-help";
    help.textContent = "Account supervisors see all account orders and manage the shared contact book from their Account page. Portal-user contact details remain separate.";
    panel.append(help);
  }

  function loadSavedContactManager() {
    if (document.querySelector('script[data-account-contacts-management="true"]')) return;
    const script = document.createElement("script");
    script.src = "/account-contacts-management.js?v=20260801-2";
    script.defer = true;
    script.dataset.accountContactsManagement = "true";
    document.body.append(script);
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
    } catch (_error) { return; }

    const profile = result?.profile;
    if (!profile || profile.role === "admin") return;

    document.getElementById("customerAccountCard")?.setAttribute("hidden", "");
    const companyInput = document.getElementById("companyName");
    if (companyInput) { companyInput.readOnly = true; companyInput.disabled = true; }

    const heading = document.querySelector(".account-heading h1");
    const copy = document.querySelector(".account-heading p");
    if (heading) heading.textContent = "Account";
    if (copy) copy.textContent = "Manage order defaults, shared contacts and sign-in security.";

    clearAdminOnlyMessage();
    loadSavedContactManager();
    window.setTimeout(clearAdminOnlyMessage, 250);
    window.setTimeout(clearAdminOnlyMessage, 1000);
  }

  function installStyles() {
    if (document.getElementById("account-role-ux-styles")) return;
    const style = document.createElement("style");
    style.id = "account-role-ux-styles";
    style.textContent = `.portal-role-help{margin:4px 0 0;max-width:760px;color:#687471;font-size:10px;line-height:1.45}.portal-user-role{font-weight:500}#customerAccountCard[hidden]{display:none!important}`;
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
        if (node instanceof Element) patchRoleLabels(node); else replaceTextNode(node);
      }));
      installHelp();
      clearAdminOnlyMessage();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true }); else install();
})();
