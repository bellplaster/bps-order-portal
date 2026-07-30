(() => {
  let contacts = [];

  const start = async () => {
    const contactInput = document.getElementById("contactName");
    const phoneInput = document.getElementById("contactMobile");
    if (!(contactInput instanceof HTMLInputElement) || !(phoneInput instanceof HTMLInputElement)) return;
    if (document.getElementById("linkedContactSelect")) return;

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
      if (!contacts.length) return;
      installPicker(contactInput, phoneInput);
    } catch (_error) {
      // Manual contact entry remains available when the convenience list cannot load.
    }
  };

  function installPicker(contactInput, phoneInput) {
    const wrapper = document.createElement("div");
    wrapper.className = "linked-contact-control";
    contactInput.parentNode.insertBefore(wrapper, contactInput);
    wrapper.append(contactInput);

    const select = document.createElement("select");
    select.id = "linkedContactSelect";
    select.className = "linked-contact-select";
    select.setAttribute("aria-label", "Choose a saved contact");
    select.title = "Choose a saved contact";
    select.append(new Option("Saved contacts", ""));

    contacts.forEach((contact, index) => {
      select.append(new Option(contact.contactName, String(index)));
    });

    select.addEventListener("change", () => {
      const selected = contacts[Number(select.value)];
      if (!selected) return;
      contactInput.value = selected.contactName;
      phoneInput.value = selected.mobile || "";
      [contactInput, phoneInput].forEach((field) => {
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.dispatchEvent(new Event("change", { bubbles: true }));
      });
      select.value = "";
      contactInput.focus({ preventScroll: true });
    });

    wrapper.append(select);
    installStyles();
  }

  function installStyles() {
    if (document.getElementById("linked-contact-picker-styles")) return;
    const style = document.createElement("style");
    style.id = "linked-contact-picker-styles";
    style.textContent = `
      .linked-contact-control {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 150px;
        width: 100%;
        min-width: 0;
        height: 100%;
      }
      .linked-contact-control > #contactName {
        min-width: 0;
        width: 100%;
        height: 100%;
        border-radius: 0 !important;
        border-right: 1px solid #d5dcda !important;
      }
      .linked-contact-select {
        width: 150px;
        min-width: 150px;
        height: 100%;
        border: 0 !important;
        border-radius: 0 !important;
        background-color: #fff;
        color: #42504d;
        padding: 0 34px 0 14px;
        font: inherit;
        font-size: 11px;
        cursor: pointer;
        box-sizing: border-box;
      }
      .linked-contact-select:focus {
        outline: 2px solid var(--bell-green, #006557);
        outline-offset: -2px;
      }
      @media (max-width: 760px) {
        .linked-contact-control { grid-template-columns: minmax(0, 1fr) 128px; }
        .linked-contact-select { width: 128px; min-width: 128px; padding-left: 10px; }
      }
    `;
    document.head.append(style);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else void start();
})();