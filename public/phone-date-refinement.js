(() => {
  const phone = {
    normalise(value, optional = false) {
      let digits = String(value || "").replace(/\D/g, "");
      if (!digits && optional) return "";
      if (digits.startsWith("61") && digits.length >= 11) digits = `0${digits.slice(2)}`;
      if (/^04\d{8}$/.test(digits)) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
      if (/^0[2378]\d{8}$/.test(digits)) return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`;
      if (/^(?:1300|1800)\d{6}$/.test(digits)) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
      if (/^13\d{4}$/.test(digits)) return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`;
      return "";
    },
    formatTyping(value) {
      let digits = String(value || "").replace(/\D/g, "");
      if (digits.startsWith("61")) digits = `0${digits.slice(2)}`;
      digits = digits.slice(0, 10);
      if (digits.startsWith("04")) return [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7)].filter(Boolean).join(" ");
      if (/^0[2378]/.test(digits)) return [digits.slice(0, 2), digits.slice(2, 6), digits.slice(6)].filter(Boolean).join(" ");
      if (/^(1300|1800)/.test(digits)) return [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7)].filter(Boolean).join(" ");
      if (digits.startsWith("13")) return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6)].filter(Boolean).join(" ");
      return digits;
    },
  };

  function addressTitleCase(value) {
    const cleaned = String(value || "").replace(/,?\s*Australia\s*$/i, "").replace(/\bVictoria\b/gi, "VIC").replace(/\s+/g, " ").trim();
    if (!cleaned) return "";
    return cleaned.toLowerCase().replace(/\b([a-z])/g, (match) => match.toUpperCase()).replace(/\bVic\b/g, "VIC").replace(/\bNsw\b/g, "NSW").replace(/\bQld\b/g, "QLD").replace(/\bSa\b/g, "SA").replace(/\bWa\b/g, "WA").replace(/\bAct\b/g, "ACT").replace(/\bNt\b/g, "NT");
  }

  function formatDisplayDate(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : "dd-----yyyy";
  }

  function openDatePicker(input) {
    input.focus({ preventScroll: true });
    if (typeof input.showPicker === "function") {
      try { input.showPicker(); } catch (_error) { input.click(); }
    } else {
      input.click();
    }
  }

  function ensureCalendarIcon(shell) {
    let icon = shell.querySelector(".date-leading-icon");
    if (!icon) {
      icon = document.createElement("button");
      icon.type = "button";
      icon.className = "date-leading-icon";
      icon.setAttribute("aria-label", "Choose required date");
      icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 10h18"></path></svg>';
      shell.append(icon);
    } else if (icon.tagName !== "BUTTON") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "date-leading-icon";
      button.setAttribute("aria-label", "Choose required date");
      button.innerHTML = icon.innerHTML;
      icon.replaceWith(button);
      icon = button;
    }
    return icon;
  }

  function ensureDateDisplay(shell) {
    let display = shell.querySelector(".required-date-display");
    if (!display) {
      display = document.createElement("span");
      display.className = "required-date-display";
      display.setAttribute("aria-hidden", "true");
      shell.prepend(display);
    }
    return display;
  }

  function initialiseRequiredDate() {
    const input = document.getElementById("requiredDate");
    if (!input) return;
    const shell = input.closest(".date-input-shell");
    if (!shell) return;

    shell.classList.add("controlled-date-control");
    const display = ensureDateDisplay(shell);
    const icon = ensureCalendarIcon(shell);

    const sync = () => {
      const hasDate = Boolean(input.value);
      shell.classList.toggle("has-date", hasDate);
      display.textContent = formatDisplayDate(input.value);
    };

    if (shell.dataset.dateControlReady !== "true") {
      shell.dataset.dateControlReady = "true";
      input.addEventListener("input", sync);
      input.addEventListener("change", sync);
      icon.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openDatePicker(input);
      });
      shell.addEventListener("click", (event) => {
        if (event.target === icon || icon.contains(event.target)) return;
        openDatePicker(input);
      });
    }
    sync();
  }

  window.BPSPhone = phone;
  window.formatAddressDisplay = addressTitleCase;
  if (typeof normaliseMobile === "function") normaliseMobile = (value, optional = false) => phone.normalise(value, optional);
  if (typeof formatMobileTyping === "function") formatMobileTyping = (value) => phone.formatTyping(value);
  if (typeof formatMobileField === "function") formatMobileField = (event) => { event.target.value = phone.formatTyping(event.target.value); };

  document.addEventListener("DOMContentLoaded", () => {
    [document.getElementById("contactMobile"), document.getElementById("defaultMobile"), document.getElementById("newDefaultMobile")].filter(Boolean).forEach((input) => {
      input.maxLength = 16;
      input.placeholder = "Phone";
      input.setAttribute("aria-label", "Phone");
    });

    initialiseRequiredDate();

    const address = document.getElementById("deliveryAddressSearch");
    if (address) {
      const refine = () => { if (address.value && address.value !== "Pickup") address.value = addressTitleCase(address.value); };
      address.addEventListener("change", refine);
      address.addEventListener("blur", refine);
    }

    const confirmation = document.getElementById("futureDateConfirmation");
    if (confirmation) {
      const text = confirmation.querySelector("span");
      if (text) text.textContent = "Confirm this date";
      confirmation.title = "This required date is more than six months away";
    }
  });

  const style = document.createElement("style");
  style.dataset.phoneDateRefinement = "true";
  style.textContent = `
    .required-date-inline{display:grid!important;grid-template-columns:minmax(180px,1fr) auto!important;align-items:stretch!important;height:39px!important}
    .required-date-inline>.date-input-shell{min-width:0!important}
    .order-form-page .date-input-shell{position:relative!important;height:39px!important;background:#fff!important;cursor:pointer!important}
    .order-form-page .date-input-shell::after{display:none!important;content:none!important}
    .order-form-page .required-date-display{position:absolute!important;z-index:2!important;left:16px!important;right:44px!important;top:0!important;display:flex!important;height:39px!important;align-items:center!important;justify-content:flex-start!important;overflow:hidden!important;color:#aab0b2!important;font:400 12px/1.35 Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;text-align:left!important;white-space:nowrap!important;pointer-events:none!important}
    .order-form-page .date-input-shell.has-date .required-date-display{color:#17211f!important}
    .order-form-page .date-leading-icon{position:absolute!important;z-index:4!important;right:10px!important;top:50%!important;display:flex!important;width:28px!important;height:28px!important;align-items:center!important;justify-content:center!important;margin:0!important;padding:0!important;color:#53615d!important;background:transparent!important;border:0!important;border-radius:0!important;outline:0!important;transform:translateY(-50%)!important;cursor:pointer!important}
    .order-form-page .date-leading-icon svg{display:block!important;width:16px!important;height:16px!important;pointer-events:none!important}
    .order-form-page .date-input-shell>#requiredDate{position:absolute!important;z-index:3!important;inset:0!important;box-sizing:border-box!important;width:100%!important;height:39px!important;min-height:39px!important;margin:0!important;padding:0!important;opacity:0!important;border:0!important;border-radius:0!important;outline:0!important;cursor:pointer!important}
    .order-form-page #requiredDate::-webkit-calendar-picker-indicator{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;margin:0!important;padding:0!important;cursor:pointer!important}
    .future-confirmation:not([hidden]){display:inline-flex!important;align-items:center!important;gap:6px!important;min-width:142px!important;height:39px!important;margin:0!important;padding:0 9px!important;border:0!important;border-left:1px solid #ead9a6!important;background:#fff9ed!important;color:#725300!important;font-size:9px!important;font-weight:650!important;line-height:1!important;white-space:nowrap!important}
    .future-confirmation input[type="checkbox"]{width:13px!important;height:13px!important;min-height:13px!important;flex:0 0 13px!important;margin:0!important}
    .selected-additional:has(>.empty-state){height:0!important;min-height:0!important;max-height:0!important;overflow:hidden!important}
    .selected-additional>.empty-state{display:none!important}
    @media(max-width:760px){.required-date-inline{grid-template-columns:1fr!important;height:auto!important}.future-confirmation:not([hidden]){min-width:0!important;width:100%!important;height:31px!important;border-left:0!important;border-top:1px solid #ead9a6!important}}
  `;
  document.head.append(style);
})();