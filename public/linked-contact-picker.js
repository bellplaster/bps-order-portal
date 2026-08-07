(() => {
  if (window.__bpsLinkedContactPickerStarted) return;
  window.__bpsLinkedContactPickerStarted = true;

  let contacts = [];
  let customerServiceMode = false;
  let customerServiceAccountId = null;
  let suppressNextFocusOpen = false;

  const start = async () => {
    const contactInput = document.getElementById("contactName");
    const phoneInput = document.getElementById("contactMobile");
    if (!(contactInput instanceof HTMLInputElement) || !(phoneInput instanceof HTMLInputElement)) return;

    removeObsoletePickers(contactInput);
    applyFieldPresentation(contactInput, phoneInput);
    installStyles();
    installDuplicateGuard(contactInput);
    contacts = [];

    const endpoint = contactEndpoint();
    if (!endpoint) return;

    try {
      const response = await fetch(endpoint, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return;
      const result = await response.json();
      const seen = new Set();
      contacts = (result.contacts || []).filter((contact) => {
        const name = String(contact.contactName || "").trim();
        const mobile = String(contact.mobile || "").trim();
        if (!name) return false;
        const key = `${name.toLowerCase()}|${mobile}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (contacts.length) installPicker(contactInput, phoneInput);
    } catch (_error) {
      // Manual contact entry remains available when saved contacts cannot load.
    }
  };

  function contactEndpoint() {
    if (!customerServiceMode) return "/api/account-contacts";
    if (!customerServiceAccountId) return null;
    return `/api/account-contacts?accountId=${encodeURIComponent(customerServiceAccountId)}`;
  }

  function removeObsoletePickers(contactInput) {
    document.querySelectorAll("#linkedContactSelect, #linkedContactButton, #linkedContactMenu").forEach((element) => element.remove());
    document.querySelectorAll(".linked-contact-control").forEach((wrapper) => {
      if (wrapper.contains(contactInput)) wrapper.parentNode?.insertBefore(contactInput, wrapper);
      wrapper.remove();
    });
    document.getElementById("linked-contact-picker-styles")?.remove();
  }

  function installDuplicateGuard(contactInput) {
    if (document.documentElement.dataset.contactPickerGuard === "true") return;
    document.documentElement.dataset.contactPickerGuard = "true";
    const clean = () => {
      document.querySelectorAll(".linked-contact-control:not([data-authoritative-contact-picker='true'])").forEach((wrapper) => {
        if (wrapper.contains(contactInput)) {
          const authoritative = document.querySelector(".linked-contact-control[data-authoritative-contact-picker='true']");
          if (!authoritative) wrapper.parentNode?.insertBefore(contactInput, wrapper);
        }
        wrapper.remove();
      });
      document.querySelectorAll("#linkedContactSelect, #linkedContactButton").forEach((element) => element.remove());
    };
    const observer = new MutationObserver(clean);
    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(clean, 0);
    window.setTimeout(clean, 500);
    window.setTimeout(clean, 1500);
  }

  function applyFieldPresentation(contactInput, phoneInput) {
    contactInput.placeholder = "Name";
    phoneInput.placeholder = "Phone";
    const placeholders = {
      deliveryStreet: "Street",
      deliveryAddressSearch: "Suburb",
      deliveryInstructions: "Access, unloading or site notes",
    };
    Object.entries(placeholders).forEach(([id, placeholder]) => {
      const field = document.getElementById(id);
      if (field) field.placeholder = placeholder;
    });
  }

  function installPicker(contactInput, phoneInput) {
    if (document.querySelector(".linked-contact-control[data-authoritative-contact-picker='true']")) return;

    const wrapper = document.createElement("div");
    wrapper.className = "linked-contact-control";
    wrapper.dataset.authoritativeContactPicker = "true";
    contactInput.parentNode.insertBefore(wrapper, contactInput);
    wrapper.append(contactInput);

    contactInput.setAttribute("role", "combobox");
    contactInput.setAttribute("aria-autocomplete", "list");
    contactInput.setAttribute("aria-haspopup", "listbox");
    contactInput.setAttribute("aria-controls", "linkedContactMenu");
    contactInput.setAttribute("aria-expanded", "false");

    const menu = document.createElement("div");
    menu.id = "linkedContactMenu";
    menu.className = "linked-contact-menu";
    menu.setAttribute("role", "listbox");
    menu.setAttribute("aria-label", "Saved contacts");
    menu.hidden = true;
    menu.innerHTML = `
      <div class="linked-contact-menu-heading">
        <span>Saved contacts</span>
        <span data-contact-result-count>${contacts.length}</span>
      </div>
      <div class="linked-contact-options"></div>
      ${customerServiceMode ? "" : `<div class="linked-contact-menu-footer">
        <a href="/account/#savedContactsSection">Manage contacts</a>
      </div>`}`;

    const optionsRoot = menu.querySelector(".linked-contact-options");
    const count = menu.querySelector("[data-contact-result-count]");
    const optionButtons = [];

    contacts.forEach((contact, index) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "linked-contact-option";
      option.dataset.contactIndex = String(index);
      option.setAttribute("role", "option");
      option.innerHTML = `
        <strong>${escapeHtml(contact.contactName)}</strong>
        <span>${escapeHtml(contact.mobile || "No phone number")}</span>`;
      option.addEventListener("mousedown", (event) => event.preventDefault());
      option.addEventListener("click", () => chooseContact(index));
      optionButtons.push(option);
      optionsRoot.append(option);
    });

    const visibleOptions = () => optionButtons.filter((option) => !option.hidden);

    const filterOptions = (query = "") => {
      const needle = String(query || "").trim().toLowerCase();
      let visibleCount = 0;
      optionButtons.forEach((option, index) => {
        const contact = contacts[index];
        const haystack = `${contact?.contactName || ""} ${contact?.mobile || ""}`.toLowerCase();
        option.hidden = Boolean(needle) && !haystack.includes(needle);
        if (!option.hidden) visibleCount += 1;
      });
      if (count) count.textContent = String(visibleCount);
      return visibleCount;
    };

    const animateOpen = () => {
      menu.animate?.([
        { opacity: 0, transform: "translateY(-5px) scale(.992)" },
        { opacity: 1, transform: "translateY(0) scale(1)" },
      ], {
        duration: 180,
        easing: "cubic-bezier(.22,.8,.2,1)",
      });
    };

    const openMenu = ({ focusFirst = false } = {}) => {
      filterOptions(contactInput.value);
      menu.hidden = false;
      contactInput.setAttribute("aria-expanded", "true");
      wrapper.classList.add("is-open");
      animateOpen();
      if (focusFirst) visibleOptions()[0]?.focus({ preventScroll: true });
    };

    const closeMenu = ({ restoreFocus = false } = {}) => {
      menu.hidden = true;
      contactInput.setAttribute("aria-expanded", "false");
      contactInput.removeAttribute("aria-activedescendant");
      wrapper.classList.remove("is-open");
      if (restoreFocus) {
        suppressNextFocusOpen = true;
        contactInput.focus({ preventScroll: true });
        queueMicrotask(() => { suppressNextFocusOpen = false; });
      }
    };

    const chooseContact = (index) => {
      const selected = contacts[index];
      if (!selected) return;
      contactInput.value = selected.contactName;
      phoneInput.value = selected.mobile || "";
      [contactInput, phoneInput].forEach((field) => {
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.dispatchEvent(new Event("change", { bubbles: true }));
      });
      closeMenu({ restoreFocus: true });
    };

    contactInput.addEventListener("focus", () => {
      if (suppressNextFocusOpen) return;
      openMenu();
    });
    contactInput.addEventListener("click", () => openMenu());
    contactInput.addEventListener("input", () => openMenu());
    contactInput.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }
      if (event.key !== "ArrowDown") return;
      event.preventDefault();
      openMenu({ focusFirst: true });
    });

    menu.addEventListener("keydown", (event) => {
      const options = visibleOptions();
      const current = options.indexOf(document.activeElement);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        const start = current < 0 ? (direction > 0 ? -1 : 0) : current;
        options[(start + direction + options.length) % options.length]?.focus();
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeMenu({ restoreFocus: true });
      }
    });

    document.addEventListener("mousedown", (event) => {
      if (!wrapper.contains(event.target)) closeMenu();
    });

    wrapper.append(menu);
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

  function installStyles() {
    if (document.getElementById("linked-contact-picker-styles")) return;
    const style = document.createElement("style");
    style.id = "linked-contact-picker-styles";
    style.textContent = `
      .linked-contact-control{position:relative;display:block;width:100%;min-width:0;height:39px;overflow:visible;box-sizing:border-box;background:#fff}
      .linked-contact-control>#contactName,.sheet-details-grid #contactMobile{box-sizing:border-box!important;width:100%!important;min-width:0!important;min-height:39px!important;height:39px!important;margin:0!important;padding:0 10px!important;border:0!important;border-radius:0!important;outline:0!important;background-color:#fff!important;color:#17211f!important;font-family:inherit!important;font-size:11px!important;font-weight:400!important;line-height:normal!important;letter-spacing:0!important;vertical-align:middle!important}
      .linked-contact-control>#contactName:focus,.sheet-details-grid #contactMobile:focus{position:relative;z-index:2;box-shadow:inset 0 0 0 1px var(--bell-green,#006557)!important}
      .linked-contact-control:not(:focus-within){box-shadow:none!important}
      .linked-contact-control>#contactName::placeholder,#contactMobile::placeholder,#deliveryStreet::placeholder,#deliveryAddressSearch::placeholder,#deliveryInstructions::placeholder{color:#9aa5a2!important;opacity:1!important;text-transform:none!important;font-family:inherit!important;font-size:11px!important;font-weight:400!important;letter-spacing:0!important}
      .linked-contact-menu{position:absolute;z-index:100003;top:calc(100% + 6px);left:0;width:390px;max-width:min(390px,calc(100vw - 48px));max-height:310px;overflow:hidden;margin:0;padding:0;border:1px solid #aebbb7;border-radius:8px;background:#fff;box-shadow:0 12px 28px rgba(23,33,31,.16);box-sizing:border-box;transform-origin:top left}
      .linked-contact-menu[hidden]{display:none!important}
      .linked-contact-menu::before,.linked-contact-menu::after{display:none!important;content:none!important}
      .linked-contact-menu-heading{display:flex;min-height:34px;align-items:center;justify-content:space-between;padding:0 9px;border-bottom:1px solid #e8edeb;background:#fafbfb;color:#7b8783;font-size:9px;font-weight:650;letter-spacing:.04em;text-transform:uppercase}
      .linked-contact-options{max-height:238px;overflow:auto;padding:3px}
      .linked-contact-option{position:relative;z-index:1;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;width:100%;min-height:42px;align-items:center;margin:0;padding:0 9px;border:0;border-radius:6px;background:#fff;color:#17211f;text-align:left;cursor:pointer;font-family:inherit;box-sizing:border-box}
      .linked-contact-option[hidden]{display:none!important}
      .linked-contact-option:hover,.linked-contact-option:focus-visible{outline:0;background:#eef6f3}
      .linked-contact-option strong{min-width:0;overflow:hidden;color:#17211f;font-size:11px;font-weight:600;line-height:1.2;text-overflow:ellipsis;white-space:nowrap}
      .linked-contact-option span{max-width:150px;overflow:hidden;color:#52605c;font-size:10px;font-weight:600;line-height:1.2;text-overflow:ellipsis;white-space:nowrap}
      .linked-contact-menu-footer{display:flex;min-height:34px;align-items:center;justify-content:flex-end;padding:0 9px;border-top:1px solid #e8edeb;background:#fafbfb}
      .linked-contact-menu-footer a{color:var(--bell-green,#006557);font-size:9px;font-weight:650;line-height:1.2;text-decoration:none}
      .linked-contact-menu-footer a:hover,.linked-contact-menu-footer a:focus-visible{text-decoration:underline;text-underline-offset:3px;outline:0}
      @media(max-width:760px){.linked-contact-menu{left:0;width:min(390px,calc(100vw - 32px))}}
    `;
    document.head.append(style);
  }

  document.addEventListener("bps:order-account-changed", (event) => {
    const detail = event.detail || {};
    customerServiceMode = detail.role === "customer_service";
    customerServiceAccountId = Number(detail.accountId || 0) || null;
    void start();
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else void start();
})();