(() => {
  let contacts = [];

  const start = async () => {
    const contactInput = document.getElementById("contactName");
    const phoneInput = document.getElementById("contactMobile");
    if (!(contactInput instanceof HTMLInputElement) || !(phoneInput instanceof HTMLInputElement)) return;
    if (document.getElementById("linkedContactButton")) return;

    const legacySelect = document.getElementById("linkedContactSelect");
    if (legacySelect) {
      const legacyWrapper = legacySelect.closest(".linked-contact-control");
      if (legacyWrapper && contactInput.parentElement === legacyWrapper) {
        legacyWrapper.parentNode?.insertBefore(contactInput, legacyWrapper);
        legacyWrapper.remove();
      } else {
        legacySelect.remove();
      }
      document.getElementById("linked-contact-picker-styles")?.remove();
    }

    applyFieldPresentation(contactInput, phoneInput);
    installStyles();

    try {
      const response = await fetch("/api/account-contacts", { headers: { Accept: "application/json" } });
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
      // Manual contact entry remains available when the convenience list cannot load.
    }
  };

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
    const wrapper = document.createElement("div");
    wrapper.className = "linked-contact-control";
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
    button.innerHTML = '<img src="/contact-notebook.svg?v=20260731-2" alt="">';

    const menu = document.createElement("div");
    menu.id = "linkedContactMenu";
    menu.className = "linked-contact-menu";
    menu.setAttribute("role", "listbox");
    menu.hidden = true;

    contacts.forEach((contact, index) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "linked-contact-option";
      option.dataset.contactIndex = String(index);
      option.setAttribute("role", "option");
      option.innerHTML = `<strong>${escapeHtml(contact.contactName)}</strong>${contact.mobile ? `<span>${escapeHtml(contact.mobile)}</span>` : ""}`;
      option.addEventListener("click", () => chooseContact(index));
      menu.append(option);
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
      } else if (event.key === "Tab") {
        closeMenu();
      }
    });
    document.addEventListener("mousedown", (event) => {
      if (!wrapper.contains(event.target)) closeMenu();
    });

    wrapper.append(button, menu);
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
      .linked-contact-control>#contactName,.sheet-details-grid #contactMobile,.sheet-details-grid #requiredDate{box-sizing:border-box!important;width:100%!important;min-width:0!important;min-height:38px!important;height:100%!important;margin:0!important;padding:0 10px!important;border:0!important;border-radius:0!important;outline:0!important;background-color:#fff!important;color:#17211f!important;font-family:inherit!important;font-size:11px!important;font-weight:400!important;line-height:38px!important;letter-spacing:0!important;vertical-align:middle!important}
      .linked-contact-control>#contactName{border-right:1px solid #d5dcda!important}
      .linked-contact-control>#contactName:focus,.sheet-details-grid #contactMobile:focus,.sheet-details-grid #requiredDate:focus{position:relative;z-index:2;box-shadow:inset 0 0 0 1px var(--bell-green,#006557)!important}
      .linked-contact-control:not(:focus-within){box-shadow:none!important}
      .linked-contact-control>#contactName::placeholder,#contactMobile::placeholder,#deliveryStreet::placeholder,#deliveryAddressSearch::placeholder,#deliveryInstructions::placeholder{color:#9aa5a2!important;opacity:1!important;text-transform:none!important;font-family:inherit!important;font-size:11px!important;font-weight:400!important;letter-spacing:0!important}
      .linked-contact-button{display:grid;place-items:center;width:38px;min-width:38px;height:100%;min-height:38px;margin:0;padding:0;border:0;border-radius:0;outline:0;background:#fff;cursor:pointer;box-sizing:border-box}
      .linked-contact-button img{display:block;width:15px;height:15px}
      .linked-contact-button:hover{background:#f5f8f7}
      .linked-contact-button:focus-visible,.linked-contact-control.is-open .linked-contact-button{box-shadow:inset 0 0 0 1px var(--bell-green,#006557)}
      .linked-contact-menu{position:absolute;z-index:100003;top:calc(100% + 4px);right:0;width:240px;max-height:280px;overflow:auto;padding:6px;border:1px solid #cfd7d4;border-radius:4px;background:#fff;box-shadow:0 10px 24px rgba(23,33,31,.16);box-sizing:border-box}
      .linked-contact-menu[hidden]{display:none!important}
      .linked-contact-menu::before{content:"";position:absolute;top:-6px;right:13px;width:10px;height:10px;border-left:1px solid #cfd7d4;border-top:1px solid #cfd7d4;background:#fff;transform:rotate(45deg)}
      .linked-contact-option{position:relative;z-index:1;display:grid;gap:2px;width:100%;margin:0;padding:9px 10px;border:0;border-radius:3px;background:#fff;color:#17211f;text-align:left;cursor:pointer;font-family:inherit;box-sizing:border-box}
      .linked-contact-option:hover,.linked-contact-option:focus{outline:0;background:#eef6f3}
      .linked-contact-option strong{font-size:11px;font-weight:600;line-height:1.3}
      .linked-contact-option span{font-size:10px;font-weight:400;line-height:1.3;color:#687471}
      .sheet-details-grid #requiredDate{position:relative!important;padding-right:42px!important;background-image:url('/calendar.svg?v=20260731-1')!important;background-repeat:no-repeat!important;background-position:right 12px center!important;background-size:14px 14px!important}
      .sheet-details-grid #requiredDate::-webkit-calendar-picker-indicator{position:absolute;right:0;width:38px;height:100%;margin:0;padding:0;opacity:0;cursor:pointer}
      @media(max-width:760px){.linked-contact-control{grid-template-columns:minmax(0,1fr) 38px}.linked-contact-menu{right:0;width:min(240px,calc(100vw - 32px))}}
    `;
    document.head.append(style);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else void start();
})();