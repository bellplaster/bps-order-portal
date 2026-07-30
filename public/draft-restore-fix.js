(() => {
  if (!document.querySelector('script[data-order-defaults="true"]')) {
    const script = document.createElement("script");
    script.src = "/order-defaults.js?v=20260729-1";
    script.defer = true;
    script.dataset.orderDefaults = "true";
    document.body.append(script);
  }

  if (!document.querySelector('script[data-order-product-payload="true"]')) {
    const script = document.createElement("script");
    script.src = "/order-product-payload.js?v=20260729-1";
    script.defer = true;
    script.dataset.orderProductPayload = "true";
    document.body.append(script);
  }

  if (!document.querySelector('script[data-admin-defaults="true"]')) {
    const script = document.createElement("script");
    script.src = "/admin-defaults.js?v=20260729-1";
    script.defer = true;
    script.dataset.adminDefaults = "true";
    document.body.append(script);
  }

  if (!document.querySelector('script[data-board-width-order="true"]')) {
    const script = document.createElement("script");
    script.src = "/board-width-order.js?v=20260729-1";
    script.defer = true;
    script.dataset.boardWidthOrder = "true";
    document.body.append(script);
  }

  if (!document.querySelector('script[data-tab-autosave="true"]')) {
    const script = document.createElement("script");
    script.src = "/tab-autosave.js?v=20260730-1";
    script.defer = true;
    script.dataset.tabAutosave = "true";
    document.body.append(script);
  }

  const syncRequiredDateState = () => {
    const input = document.getElementById("requiredDate");
    if (!(input instanceof HTMLInputElement)) return false;
    input.classList.toggle("has-date-value", Boolean(input.value));
    return true;
  };

  const initialiseRequiredDateState = () => {
    const input = document.getElementById("requiredDate");
    if (!(input instanceof HTMLInputElement)) return false;

    syncRequiredDateState();
    if (input.dataset.dateValueState !== "true") {
      input.dataset.dateValueState = "true";
      ["input", "change", "blur"].forEach((eventName) => {
        input.addEventListener(eventName, syncRequiredDateState);
      });
    }
    return true;
  };

  const initialiseSafeOrderSubmission = () => {
    const form = document.getElementById("orderForm");
    if (!(form instanceof HTMLFormElement) || form.dataset.safeSubmitBound === "true") return Boolean(form);
    form.dataset.safeSubmitBound = "true";

    form.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.isComposing) return;
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest(".area-name-editor")) return;
      if (target instanceof HTMLTextAreaElement) return;
      if (target instanceof HTMLButtonElement && target.id === "submitButton") return;
      event.preventDefault();
      event.stopPropagation();
    }, true);

    form.addEventListener("submit", (event) => {
      if (event.target instanceof HTMLFormElement && event.target.classList.contains("area-name-editor")) return;

      const submitter = event.submitter;
      const intentionalSubmit = submitter instanceof HTMLButtonElement
        && submitter.id === "submitButton"
        && typeof state !== "undefined"
        && state.activeStep === "review";
      if (intentionalSubmit) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }, true);
    return true;
  };

  const start = () => {
    initialiseRequiredDateState();
    initialiseSafeOrderSubmission();

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      initialiseRequiredDateState();
      initialiseSafeOrderSubmission();
      if (attempts >= 30) window.clearInterval(timer);
    }, 100);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  window.addEventListener("pageshow", () => {
    syncRequiredDateState();
    initialiseSafeOrderSubmission();
  });

  const style = document.createElement("style");
  style.dataset.requiredDateValueState = "true";
  style.textContent = `
    .order-form-page #requiredDate.has-date-value,
    .order-form-page #requiredDate.has-date-value::-webkit-datetime-edit,
    .order-form-page #requiredDate.has-date-value::-webkit-datetime-edit-text,
    .order-form-page #requiredDate.has-date-value::-webkit-datetime-edit-day-field,
    .order-form-page #requiredDate.has-date-value::-webkit-datetime-edit-month-field,
    .order-form-page #requiredDate.has-date-value::-webkit-datetime-edit-year-field {
      color: #17211f !important;
    }
  `;
  document.head.append(style);
})();