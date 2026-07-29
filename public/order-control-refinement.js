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

  if (!document.querySelector('script[data-metal-casing-bead="true"]')) {
    const script = document.createElement("script");
    script.src = "/metal-casing-bead-refinement.js?v=20260729-1";
    script.defer = true;
    script.dataset.metalCasingBead = "true";
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

  const start = () => {
    initialiseRequiredDateState();

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      initialiseRequiredDateState();
      if (attempts >= 30) window.clearInterval(timer);
    }, 100);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  window.addEventListener("pageshow", syncRequiredDateState);

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