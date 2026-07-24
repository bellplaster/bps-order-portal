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
  window.BPSPhone = phone;
  window.formatAddressDisplay = addressTitleCase;
  if (typeof normaliseMobile === "function") normaliseMobile = (value, optional = false) => phone.normalise(value, optional);
  if (typeof formatMobileTyping === "function") formatMobileTyping = (value) => phone.formatTyping(value);
  if (typeof formatMobileField === "function") formatMobileField = (event) => { event.target.value = phone.formatTyping(event.target.value); };
  document.addEventListener("DOMContentLoaded", () => {
    [document.getElementById("contactMobile"), document.getElementById("defaultMobile"), document.getElementById("newDefaultMobile")].filter(Boolean).forEach((input) => {
      input.maxLength = 16;
      input.placeholder = "03 0000 0000";
      input.setAttribute("aria-label", "Phone");
    });
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
  style.textContent = `.required-date-inline{display:grid!important;grid-template-columns:minmax(180px,1fr) auto!important;align-items:stretch!important;height:39px!important}.required-date-inline>.date-input-shell{min-width:0!important}.future-confirmation:not([hidden]){display:inline-flex!important;align-items:center!important;gap:6px!important;min-width:142px!important;height:39px!important;margin:0!important;padding:0 9px!important;border:0!important;border-left:1px solid #ead9a6!important;background:#fff9ed!important;color:#725300!important;font-size:9px!important;font-weight:650!important;line-height:1!important;white-space:nowrap!important}.future-confirmation input[type="checkbox"]{width:13px!important;height:13px!important;min-height:13px!important;flex:0 0 13px!important;margin:0!important}@media(max-width:760px){.required-date-inline{grid-template-columns:1fr!important;height:auto!important}.future-confirmation:not([hidden]){min-width:0!important;width:100%!important;height:31px!important;border-left:0!important;border-top:1px solid #ead9a6!important}}`;
  document.head.append(style);
})();