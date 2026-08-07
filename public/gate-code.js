(() => {
  if (window.__bpsGateCodeLoaded) return;
  window.__bpsGateCodeLoaded = true;

  const MAX_LENGTH = 6;

  function normaliseGateCode(value) {
    return String(value || "").replace(/\D/g, "").slice(0, MAX_LENGTH);
  }

  function gateCodeValue() {
    const notApplicable = document.getElementById("gateCodeNotApplicable")?.checked === true;
    return notApplicable ? "N/A" : normaliseGateCode(document.getElementById("gateCode")?.value);
  }

  function installStyles() {
    if (document.getElementById("gateCodeStyles")) return;
    const style = document.createElement("style");
    style.id = "gateCodeStyles";
    style.textContent = `
      .delivery-instruction-controls{
        grid-template-columns:repeat(4,minmax(0,1fr))!important;
      }
      .delivery-instruction-controls>.delivery-select-field{
        display:grid!important;
        grid-template-columns:112px minmax(0,1fr);
        min-width:0;
      }
      .delivery-instruction-controls>.delivery-select-field>span{
        border-left:0;
      }
      .gate-code-control{
        min-width:0;
        height:39px;
        display:flex;
        align-items:center;
        gap:8px;
        padding:0 8px;
        background:#fff;
        border-right:0;
      }
      .gate-code-control input[type="text"]{
        width:82px;
        min-width:0;
        height:30px;
        margin:0;
        padding:0 8px;
        color:var(--ink);
        background:#fff;
        border:1px solid #d4d9d7;
        border-radius:0!important;
        outline:0;
        font:inherit;
        font-size:11px;
      }
      .gate-code-control input[type="text"]:focus{
        border-color:var(--bell-green);
        box-shadow:inset 0 0 0 1px var(--bell-green);
      }
      .gate-code-na{
        display:inline-flex;
        align-items:center;
        gap:5px;
        white-space:nowrap;
        color:var(--ink);
        font-size:11px;
        cursor:pointer;
      }
      .gate-code-na input{
        width:14px;
        height:14px;
        margin:0;
        accent-color:var(--bell-maroon);
      }
      .gate-code-control.is-invalid input[type="text"]{
        border-color:#b42318;
        box-shadow:inset 0 0 0 1px #b42318;
      }
      @media(max-width:980px){
        .delivery-instruction-controls{
          grid-template-columns:1fr 1fr!important;
        }
        .delivery-instruction-controls>.delivery-select-field{
          grid-template-columns:100px minmax(0,1fr);
          border-bottom:1px solid #d4d9d7;
        }
      }
      @media(max-width:640px){
        .delivery-instruction-controls{
          grid-template-columns:1fr!important;
        }
      }
    `;
    document.head.append(style);
  }

  function createGateCodeControl() {
    const row = document.querySelector(".delivery-instruction-controls");
    if (!row || row.querySelector(".gate-code-field")) return false;

    const wrapper = document.createElement("div");
    wrapper.className = "delivery-select-field gate-code-field";

    const label = document.createElement("span");
    label.textContent = "Gate Code";

    const control = document.createElement("div");
    control.className = "gate-code-control";

    const input = document.createElement("input");
    input.id = "gateCode";
    input.type = "text";
    input.inputMode = "numeric";
    input.autocomplete = "off";
    input.maxLength = MAX_LENGTH;
    input.placeholder = "Code";
    input.setAttribute("aria-label", "Gate code, 4 to 6 digits");

    const naLabel = document.createElement("label");
    naLabel.className = "gate-code-na";
    const na = document.createElement("input");
    na.id = "gateCodeNotApplicable";
    na.type = "checkbox";
    const naText = document.createElement("span");
    naText.textContent = "N/A";
    naLabel.append(na, naText);

    input.addEventListener("input", () => {
      input.value = normaliseGateCode(input.value);
      if (input.value) na.checked = false;
      input.disabled = false;
      control.classList.remove("is-invalid");
      window.scheduleDraft?.();
    });

    na.addEventListener("change", () => {
      if (na.checked) {
        input.value = "";
        input.disabled = true;
      } else {
        input.disabled = false;
        input.focus();
      }
      control.classList.remove("is-invalid");
      window.scheduleDraft?.();
    });

    control.append(input, naLabel);
    wrapper.append(label, control);
    row.append(wrapper);
    return true;
  }

  function validateGateCode() {
    const input = document.getElementById("gateCode");
    const na = document.getElementById("gateCodeNotApplicable");
    const control = input?.closest(".gate-code-control");
    if (!input || !na) return true;

    const code = normaliseGateCode(input.value);
    input.value = code;
    const valid = na.checked || /^\d{4,6}$/.test(code);
    control?.classList.toggle("is-invalid", !valid);
    if (!valid) {
      input.disabled = false;
      input.focus();
      throw (typeof window.fieldError === "function"
        ? window.fieldError("gateCode", "Enter a 4–6 digit gate code or select N/A.")
        : new Error("Enter a 4–6 digit gate code or select N/A."));
    }
    return true;
  }

  function patchOrderFlow() {
    if (typeof window.validateForm === "function" && !window.validateForm.__gateCodePatched) {
      const originalValidate = window.validateForm;
      const patchedValidate = function gateCodeValidatedForm(...args) {
        const result = originalValidate.apply(this, args);
        validateGateCode();
        return result;
      };
      patchedValidate.__gateCodePatched = true;
      window.validateForm = patchedValidate;
      try { validateForm = patchedValidate; } catch (_error) { }
    }

    if (typeof window.buildPayload === "function" && !window.buildPayload.__gateCodePatched) {
      const originalBuildPayload = window.buildPayload;
      const patchedBuildPayload = function gateCodePayload(...args) {
        return { ...originalBuildPayload.apply(this, args), gateCode: gateCodeValue() };
      };
      patchedBuildPayload.__gateCodePatched = true;
      window.buildPayload = patchedBuildPayload;
      try { buildPayload = patchedBuildPayload; } catch (_error) { }
    }

    if (typeof window.applyPayload === "function" && !window.applyPayload.__gateCodePatched) {
      const originalApplyPayload = window.applyPayload;
      const patchedApplyPayload = function applyGateCodePayload(payload, ...args) {
        const result = originalApplyPayload.call(this, payload, ...args);
        queueMicrotask(() => {
          const input = document.getElementById("gateCode");
          const na = document.getElementById("gateCodeNotApplicable");
          if (!input || !na) return;
          const saved = String(payload?.gateCode || "").trim();
          na.checked = saved.toUpperCase() === "N/A";
          input.value = na.checked ? "" : normaliseGateCode(saved);
          input.disabled = na.checked;
        });
        return result;
      };
      patchedApplyPayload.__gateCodePatched = true;
      window.applyPayload = patchedApplyPayload;
      try { applyPayload = patchedApplyPayload; } catch (_error) { }
    }
  }

  function initialise() {
    installStyles();
    createGateCodeControl();
    patchOrderFlow();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialise, { once: true });
  else initialise();

  window.addEventListener("load", initialise, { once: true });
  const observer = new MutationObserver(() => {
    if (createGateCodeControl()) patchOrderFlow();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
