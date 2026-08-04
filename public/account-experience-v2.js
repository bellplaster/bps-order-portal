(() => {
  if (window.__bpsAccountExperienceV2Started) return;
  window.__bpsAccountExperienceV2Started = true;

  let profile = null;
  let main = null;
  let nav = null;
  let observer = null;
  let requestedHashHandled = false;

  async function start() {
    profile = await loadProfile();
    document.body.classList.add("account-experience-v2");
    buildLayout();
    decorateSections();
    reorderSections();
    installDynamicSectionObserver();
    installNavigation();
    scrollToRequestedSection();
  }

  async function loadProfile() {
    try {
      const response = await fetch("/api/account", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return null;
      const result = await response.json().catch(() => ({}));
      return result?.profile || null;
    } catch (_error) {
      return null;
    }
  }

  function buildLayout() {
    const shell = document.querySelector(".account-shell");
    if (!shell || shell.querySelector(".account-layout-v2")) return;

    const layout = document.createElement("div");
    layout.className = "account-layout-v2";

    const sidebar = document.createElement("aside");
    sidebar.className = "account-sidebar-v2";
    sidebar.setAttribute("aria-label", "Account sections");
    sidebar.innerHTML = `
      <div class="account-sidebar-brand-v2">
        <strong>${escapeHtml(profile?.companyName || "Bell Plaster account")}</strong>
        <span>Manage ordering preferences and shared account details.</span>
      </div>
      <nav class="account-nav-v2">
        <a href="#accountProfileV2" data-account-nav="profile">Profile</a>
        <a href="#orderDefaultsSection" data-account-nav="defaults">Order defaults</a>
        <a href="#savedContactsSection" data-account-nav="contacts" hidden>Saved contacts</a>
        <a href="#savedAddressesSection" data-account-nav="addresses" hidden>Saved addresses</a>
        <a href="#adminSection" data-account-nav="admin" hidden>Administration</a>
        <a href="#securitySection" data-account-nav="security">Security</a>
      </nav>
      <div class="account-sidebar-actions-v2"><a href="/">Start an order</a></div>`;

    main = document.createElement("div");
    main.className = "account-main-v2";
    main.append(buildProfileCard());

    const message = document.getElementById("accountMessage");
    const accountForm = document.getElementById("accountForm");
    const savedContacts = document.getElementById("savedContactsSection");
    const savedAddresses = document.getElementById("savedAddressesSection");
    const adminSection = document.getElementById("adminSection");
    const security = document.querySelector(".security-card");
    const heading = document.querySelector(".account-heading");

    if (message) main.append(message);
    if (accountForm) main.append(accountForm);
    if (savedContacts) main.append(savedContacts);
    if (savedAddresses) main.append(savedAddresses);
    if (adminSection) main.append(adminSection);
    if (security) main.append(security);
    heading?.remove();

    layout.append(sidebar, main);
    shell.replaceChildren(layout);
    nav = sidebar.querySelector(".account-nav-v2");
  }

  function buildProfileCard() {
    const card = document.createElement("section");
    card.id = "accountProfileV2";
    card.className = "account-profile-card-v2";

    const company = profile?.companyName || (profile?.role === "admin" ? "Bell Plaster Administration" : "Account");
    const initials = company.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "BP";
    const role = roleLabel(profile?.role);
    const descriptor = profile?.role === "admin"
      ? "Manage portal users, customer accounts and your administrator order defaults."
      : "Your shared ordering profile, defaults, contacts and delivery locations.";

    card.innerHTML = `
      <div class="account-profile-avatar-v2" aria-hidden="true">${escapeHtml(initials)}</div>
      <div class="account-profile-copy-v2">
        <h1>${escapeHtml(company)}</h1>
        <p>${escapeHtml(descriptor)}</p>
        <div class="account-profile-meta-v2">
          ${profile?.debtorCode ? `<span>Debtor ${escapeHtml(profile.debtorCode)}</span>` : ""}
          ${profile?.username ? `<span>${escapeHtml(profile.username)}</span>` : ""}
        </div>
      </div>
      <span class="account-profile-role-v2">${escapeHtml(role)}</span>`;
    return card;
  }

  function decorateSections(root = document) {
    const customerCard = document.getElementById("customerAccountCard");
    if (customerCard) customerCard.hidden = true;

    const accountForm = document.getElementById("accountForm");
    const defaults = accountForm?.querySelector(".account-section:not(#customerAccountCard)");
    if (defaults) {
      defaults.id = "orderDefaultsSection";
      enhanceHeader(defaults, "Order defaults", "Pre-fill the details you use most often. You can still change them on each order.");
    }

    const contacts = root.querySelector?.("#savedContactsSection");
    if (contacts) enhanceHeader(contacts, "Saved contacts", "Shared people your team regularly orders for.");

    const addresses = root.querySelector?.("#savedAddressesSection");
    if (addresses) enhanceHeader(addresses, "Saved addresses", "Frequently used delivery sites available from the order form.");

    const security = document.querySelector(".security-card");
    if (security) {
      security.id = "securitySection";
      enhanceHeader(security, "Security", "Update your portal sign-in password.");
    }

    const admin = document.getElementById("adminSection");
    if (admin) enhanceHeader(admin, "Administration", "Manage customers, portal users and catalogue tools.");
  }

  function enhanceHeader(section, title, description) {
    const header = section.querySelector(":scope > .account-section-bar");
    if (!header || header.dataset.accountV2Header === "true") return;
    header.dataset.accountV2Header = "true";
    const heading = header.querySelector("h2") || document.createElement("h2");
    heading.textContent = title;
    let copy = header.querySelector("p");
    if (!copy) {
      copy = document.createElement("p");
      const wrapper = document.createElement("div");
      heading.replaceWith(wrapper);
      wrapper.append(heading, copy);
      header.prepend(wrapper);
    }
    copy.textContent = description;
  }

  function reorderSections() {
    if (!main) return;
    const order = [
      document.getElementById("accountProfileV2"),
      document.getElementById("accountMessage"),
      document.getElementById("accountForm"),
      document.getElementById("savedContactsSection"),
      document.getElementById("savedAddressesSection"),
      document.getElementById("adminSection"),
      document.getElementById("securitySection"),
    ];
    order.filter(Boolean).forEach((element) => main.append(element));
    updateNavigationVisibility();
    scrollToRequestedSection();
  }

  function installDynamicSectionObserver() {
    if (!main || observer) return;
    observer = new MutationObserver((mutations) => {
      let structureChanged = false;
      let visibilityChanged = false;
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes") {
          if (mutation.target instanceof Element && mutation.target.id === "adminSection") visibilityChanged = true;
          return;
        }
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches?.("#savedContactsSection, #savedAddressesSection") || node.querySelector?.("#savedContactsSection, #savedAddressesSection")) structureChanged = true;
        });
      });

      if (structureChanged) {
        decorateSections();
        reorderSections();
        refreshObservedSections();
      } else if (visibilityChanged) {
        updateNavigationVisibility();
        refreshObservedSections();
      }
    });
    observer.observe(main, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden"],
    });
  }

  function installNavigation() {
    if (!nav) return;
    nav.addEventListener("click", (event) => {
      const link = event.target.closest("a[href^='#']");
      if (!link) return;
      const target = document.querySelector(link.getAttribute("href"));
      if (!target) return;
      event.preventDefault();
      history.replaceState(history.state, "", link.getAttribute("href"));
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    refreshObservedSections();
  }

  let sectionObserver = null;
  function refreshObservedSections() {
    sectionObserver?.disconnect();
    if (!("IntersectionObserver" in window) || !nav) return;
    sectionObserver = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      nav.querySelectorAll("a").forEach((link) => {
        link.classList.toggle("is-active", link.getAttribute("href") === `#${visible.target.id}`);
      });
    }, { rootMargin: "-100px 0px -62% 0px", threshold: [0.05, 0.25, 0.5] });

    nav.querySelectorAll("a:not([hidden])").forEach((link) => {
      const target = document.querySelector(link.getAttribute("href"));
      if (target) sectionObserver.observe(target);
    });
  }

  function updateNavigationVisibility() {
    if (!nav) return;
    const mappings = {
      contacts: "savedContactsSection",
      addresses: "savedAddressesSection",
      admin: "adminSection",
    };
    Object.entries(mappings).forEach(([key, id]) => {
      const link = nav.querySelector(`[data-account-nav="${key}"]`);
      const section = document.getElementById(id);
      const shouldHide = !section || (id === "adminSection" && section.hidden);
      if (link && link.hidden !== shouldHide) link.hidden = shouldHide;
    });
  }

  function scrollToRequestedSection() {
    if (requestedHashHandled || !location.hash) return;
    let target = null;
    try {
      target = document.querySelector(location.hash);
    } catch (_error) {
      return;
    }
    if (!target) return;
    requestedHashHandled = true;
    requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
  }

  function roleLabel(role) {
    if (role === "admin") return "Administrator";
    if (role === "customer_service") return "Customer Service";
    return "Customer account";
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void start(), { once: true });
  else void start();
})();
