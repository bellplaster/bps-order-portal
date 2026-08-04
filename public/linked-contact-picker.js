(() => {
  if (window.__bpsLinkedContactPickerStarted) return;
  window.__bpsLinkedContactPickerStarted = true;

  let contacts = [];

  const start = async () => {
    const contactInput = document.getElementById("contactName");
    const phoneInput = document.getElementById("contactMobile");
    if (!(contactInput instanceof HTMLInputElement) || !(phoneInput instanceof HTMLInputElement)) return;

    removeObsoletePickers(contactInput);
    applyFieldPresentation(contactInput, phoneInput);
    installStyles();
    installDuplicateGuard(contactInput);

    try {
      const response = await fetch("/api/account-contacts", {
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
      document.querySelectorAll("#linkedContactSelect").forEach((select) => select.remove());
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

    const button = document.createElement("button");
    button.id = "linkedContactButton";
    button.className = "linked-contact-button";
    button.type = "button";
    button.setAttribute("aria-label", "Choose a saved contact");
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");
    button.title = "Choose a saved contact";
    button.innerHTML = '<img src="/contact-notebook.svg?v=20260731-3" alt="">';

    const menu = document.createElement("div");
    menu.id = "linkedContactMenu";
    menu.className = "linked-contact-menu";
    menu.setAttribute("role", "listbox");
    menu.setAttribute("aria-label", "Saved contacts");
    menu.hidden = true;
    menu.innerHTML = `
      <div class="linked-contact-menu-heading">
        <span>Saved contacts</span>
        <span>${contacts.length}</span>
      </div>
      <div class="linked-contact-options"></div>
      <div class="linked-contact-menu-footer">
        <a href="/account/#savedContactsSection">Manage contacts</a>
      </div>`;

    const optionsRoot = menu.querySelector(".linked-contact-options");
    contacts.forEach((contact, index) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "linked-contact-option";
      option.dataset.contactIndex = String(index);
      option.setAttribute("role", "option");
      option.innerHTML = `
        <span class="linked-contact-avatar" aria-hidden="true">${escapeHtml(initials(contact.contactName))}</span>
        <span class="linked-contact-copy">
          <strong>${escapeHtml(contact.contactName)}</strong>
          ${contact.mobile ? `<span>${escapeHtml(contact.mobile)}</span>` : '<span>No phone number</span>'}
        </span>`;
      option.addEventListener("click", () => chooseContact(index));
      optionsRoot.append(option);
    });

    const openMenu = () => {
      menu.hidden = false;
      button.setAttribute("aria-expanded", "true");
      wrapper.classList.add("is-open");
      menu.querySelector(".linked-contact-option")?.focus({ preventScroll: true });
    };

    const closeMenu = (restoreFocus = false) => {
      menu.hidden = true;
      button.setAttribute("aria-expanded", "false");
      wrapper.classList.remove("is-open");
      if (restoreFocus) button.focus({ preventScroll: true });
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
      closeMenu();
      contactInput.focus({ preventScroll: true });
    };

    button.addEventListener("click", () => menu.hidden ? openMenu() : closeMenu(true));
    button.addEventListener("keydown", (event) => {
      if (["ArrowDown", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openMenu();
      }
    });
    menu.addEventListener("keydown", (event) => {
      const options = [...menu.querySelectorAll(".linked-contact-option")];
      const current = options.indexOf(document.activeElement);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        options[(current + direction + options.length) % options.length]?.focus();
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
      }
    });
    document.addEventListener("mousedown", (event) => {
      if (!wrapper.contains(event.target)) closeMenu();
    });

    wrapper.append(button, menu);
  }

  function initials(value) {
    const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "C";
    return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
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
      .linked-contact-control{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 38px;width:100%;min-width:0;height:100%;box-sizing:border-box;background:#fff}
      .linked-contact-control>#contactName,.sheet-details-grid #contactMobile,.sheet-details-grid #requiredDate{box-sizing:border-box!important;width:100%!important;min-width:0!important;min-height:38px!important;height:38px!important;margin:0!important;padding:0 10px!important;border:0!important;border-radius:0!important;outline:0!important;background-color:#fff!important;color:#17211f!important;font-family:inherit!important;font-size:11px!important;font-weight:400!important;line-height:normal!important;letter-spacing:0!important;vertical-align:middle!important}
      .linked-contact-control>#contactName{border-right:1px solid #d5dcda!important}
      .linked-contact-control>#contactName:focus,.sheet-details-grid #contactMobile:focus,.sheet-details-grid #requiredDate:focus{position:relative;z-index:2;box-shadow:inset 0 0 0 1px var(--bell-green,#006557)!important}
      .linked-contact-control:not(:focus-within){box-shadow:none!important}
      .linked-contact-control>#contactName::placeholder,#contactMobile::placeholder,#deliveryStreet::placeholder,#deliveryAddressSearch::placeholder,#deliveryInstructions::placeholder{color:#9aa5a2!important;opacity:1!important;text-transform:none!important;font-family:inherit!important;font-size:11px!important;font-weight:400!important;letter-spacing:0!important}
      .linked-contact-button{display:grid;place-items:center;width:38px;min-width:38px;height:38px;margin:0;padding:0;border:0;border-radius:0;outline:0;background:#fff;cursor:pointer;box-sizing:border-box}
      .linked-contact-button img{display:block;width:15px;height:15px}
      .linked-contact-button:hover{background:#f5f8f7}
      .linked-contact-button:focus-visible,.linked-contact-control.is-open .linked-contact-button{position:relative;z-index:3;box-shadow:inset 0 0 0 1px var(--bell-green,#006557)}
      .linked-contact-menu{position:absolute;z-index:100003;top:calc(100% + 6px);right:0;width:300px;max-height:360px;overflow:hidden;margin:0;padding:0;border:1px solid #d4d7d6;border-radius:12px;background:#fff;box-shadow:0 14px 34px rgba(23,33,31,.17);box-sizing:border-box}
      .linked-contact-menu[hidden]{display:none!important}
      .linked-contact-menu::before,.linked-contact-menu::after{display:none!important;content:none!important}
      .linked-contact-menu-heading{display:flex;min-height:38px;align-items:center;justify-content:space-between;padding:0 12px;border-bottom:1px solid #eceeed;background:#fff;color:#687471;font-size:10px;font-weight:600;letter-spacing:.04em;text-transform:uppercase}
      .linked-contact-options{max-height:250px;overflow:auto;padding:5px}
      .linked-contact-option{position:relative;z-index:1;display:grid;grid-template-columns:34px minmax(0,1fr);gap:10px;width:100%;min-height:52px;align-items:center;margin:0;padding:8px 9px;border:0;border-radius:8px;background:#fff;color:#17211f;text-align:left;cursor:pointer;font-family:inherit;box-sizing:border-box}
      .linked-contact-option:hover,.linked-contact-option:focus-visible{outline:0;background:#eef6f3}
      .linked-contact-avatar{display:grid;width:34px;height:34px;place-items:center;border-radius:10px;background:#f0f3f2;color:#40504b;font-size:10px;font-weight:700;letter-spacing:.01em}
      .linked-contact-copy{display:grid;min-width:0;gap:3px}
      .linked-contact-copy strong{overflow:hidden;color:#17211f;font-size:12px;font-weight:650;line-height:1.3;text-overflow:ellipsis;white-space:nowrap}
      .linked-contact-copy span{overflow:hidden;color:#687471;font-size:10px;font-weight:400;line-height:1.3;text-overflow:ellipsis;white-space:nowrap}
      .linked-contact-menu-footer{display:flex;min-height:38px;align-items:center;justify-content:flex-end;padding:0 12px;border-top:1px solid #eceeed;background:#fff}
      .linked-contact-menu-footer a{color:var(--bell-green,#006557);font-size:10px;font-weight:650;line-height:1.2;text-decoration:none}
      .linked-contact-menu-footer a:hover,.linked-contact-menu-footer a:focus-visible{text-decoration:underline;text-underline-offset:3px;outline:0}
      .sheet-field-row:has(>#requiredDate){position:relative!important}
      .sheet-field-row:has(>#requiredDate)::after{content:"";position:absolute;z-index:3;right:12px;top:50%;width:14px;height:14px;pointer-events:none;background:url('/calendar.svg?v=20260731-2') center/14px 14px no-repeat;transform:translateY(-50%)}
      .sheet-details-grid #requiredDate{padding-right:44px!important;background-image:none!important}
      .sheet-details-grid #requiredDate::-webkit-calendar-picker-indicator{position:absolute!important;z-index:4!important;right:0!important;top:0!important;width:38px!important;height:38px!important;margin:0!important;padding:0!important;opacity:0!important;cursor:pointer!important}
      @media(max-width:760px){.linked-contact-control{grid-template-columns:minmax(0,1fr) 38px}.linked-contact-menu{right:0;width:min(300px,calc(100vw - 32px))}}
    `;
    document.head.append(style);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else void start();
})();