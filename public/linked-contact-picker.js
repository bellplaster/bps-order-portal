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
      contacts = (result.contacts || []).filter((contact) => contact.contactName || contact.mobile);
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
      const name = contact.contactName || contact.username;
      const detail = [contact.mobile, contact.username !== name ? contact.username : ""].filter(Boolean).join(" · ");
      select.append(new Option(detail ? `${name} — ${detail}` : name, String(index)));
    });

    select.addEventListener("change", () => {
      const selected = contacts[Number(select.value)];
      if (!selected) return;
      contactInput.value = selected.contactName || selected.username;
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
        grid-template-columns: minmax(0, 1fr) auto;
        width: 100%;
        min-width: 0;
      }
      .linked-contact-control > #contactName {
        min-width: 0;
        border-right: 0 !important;
      }
      .linked-contact-select {
        width: 148px;
        min-width: 148px;
        border: 0;
        border-left: 1px solid #d5dcda;
        background: #fff;
        color: #42504d;
        padding: 0 28px 0 10px;
        font: inherit;
        font-size: 11px;
        cursor: pointer;
      }
      .linked-contact-select:focus {
        outline: 2px solid var(--bell-green, #006557);
        outline-offset: -2px;
      }
      @media (max-width: 760px) {
        .linked-contact-select { width: 122px; min-width: 122px; }
      }
    `;
    document.head.append(style);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else void start();
})();
