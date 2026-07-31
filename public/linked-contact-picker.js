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
      .linked-contact-control>#contactName,.sheet-details-grid #contactMobile,.sheet-details-grid #requiredDate{box-sizing:border-box!important;width:100%!important;min-width:0!important;min-height:38px!important;height:38px!important;margin:0!important;padding:0 10px!important;border:0!important;border-radius:0!important;outline:0!important;background-color:#fff!important;color:#17211f!important;font-family:inherit!important;font-size:11px!important;font-weight:400!important;line-height:normal!important;letter-spacing:0!important;vertical-align:middle!important}
      .linked-contact-control>#contactName{border-right:1px solid #d5dcda!important}
      .linked-contact-control>#contactName:focus,.sheet-details-grid #contactMobile:focus,.sheet-details-grid #requiredDate:focus{position:relative;z-index:2;box-shadow:inset 0 0 0 1px var(--bell-green,#006557)!important}
      .linked-contact-control:not(:focus-within){box-shadow:none!important}
      .linked-contact-control>#contactName::placeholder,#contactMobile::placeholder,#deliveryStreet::placeholder,#deliveryAddressSearch::placeholder,#deliveryInstructions::placeholder{color:#9aa5a2!important;opacity:1!important;text-transform:none!important;font-family:inherit!important;font-size:11px!important;font-weight:400!important;letter-spacing:0!important}
      .linked-contact-button{display:grid;place-items:center;width:38px;min-width:38px;height:38px;margin:0;padding:0;border:0;border-radius:0;outline:0;background:#fff;cursor:pointer;box-sizing:border-box}
      .linked-contact-button img{display:block;width:15px;height:15px}
      .linked-contact-button:hover{background:#f5f8f7}
      .linked-contact-button:focus-visible,.linked-contact-control.is-open .linked-contact-button{box-shadow:inset 0 0 0 1px var(--bell-green,#006557)}
      .linked-contact-menu{position:absolute;z-index:100003;top:100%;right:0;width:240px;max-height:280px;overflow:auto;margin:0;padding:6px;border:1px solid #cfd7d4;border-radius:0 0 4px 4px;background:#fff;box-shadow:0 10px 24px rgba(23,33,31,.16);box-sizing:border-box}
      .linked-contact-menu[hidden]{display:none!important}
      .linked-contact-menu::before,.linked-contact-menu::after{display:none!important;content:none!important}
      .linked-contact-option{position:relative;z-index:1;display:grid;gap:2px;width:100%;margin:0;padding:9px 10px;border:0;border-radius:3px;background:#fff;color:#17211f;text-align:left;cursor:pointer;font-family:inherit;box-sizing:border-box}
      .linked-contact-option:hover,.linked-contact-option:focus{outline:0;background:#eef6f3}
      .linked-contact-option strong{font-size:11px;font-weight:600;line-height:1.3}
      .linked-contact-option span{font-size:10px;font-weight:400;line-height:1.3;color:#687471}
      .sheet-field-row:has(>#requiredDate){position:relative!important}
      .sheet-field-row:has(>#requiredDate)::after{content:"";position:absolute;z-index:3;right:12px;top:50%;width:14px;height:14px;pointer-events:none;background:url('/calendar.svg?v=20260731-2') center/14px 14px no-repeat;transform:translateY(-50%)}
      .sheet-details-grid #requiredDate{padding-right:44px!important;background-image:none!important}
      .sheet-details-grid #requiredDate::-webkit-calendar-picker-indicator{position:absolute!important;z-index:4!important;right:0!important;top:0!important;width:38px!important;height:38px!important;margin:0!important;padding:0!important;opacity:0!important;cursor:pointer!important}
      @media(max-width:760px){.linked-contact-control{grid-template-columns:minmax(0,1fr) 38px}.linked-contact-menu{right:0;width:min(240px,calc(100vw - 32px))}}
    `;
    document.head.append(style);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else void start();
})();