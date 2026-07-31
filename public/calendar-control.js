(() => {
  if (window.__bpsCalendarControlStarted) return;
  window.__bpsCalendarControlStarted = true;

  function install() {
    const input = document.getElementById("requiredDate");
    if (!(input instanceof HTMLInputElement)) return false;

    input.dataset.authoritativeCalendarControl = "true";

    if (!document.getElementById("authoritative-calendar-control-styles")) {
      const style = document.createElement("style");
      style.id = "authoritative-calendar-control-styles";
      style.textContent = `
        .sheet-field-row:has(>#requiredDate)::after{display:none!important;content:none!important}
        .sheet-details-grid #requiredDate{
          box-sizing:border-box!important;
          height:38px!important;
          padding:0 44px 0 10px!important;
          background-color:#fff!important;
          background-image:url('/calendar.svg?v=20260731-3')!important;
          background-repeat:no-repeat!important;
          background-position:right 12px center!important;
          background-size:15px 15px!important;
        }
        .sheet-details-grid #requiredDate::-webkit-calendar-picker-indicator{
          display:none!important;
          width:0!important;
          height:0!important;
          margin:0!important;
          padding:0!important;
          opacity:0!important;
        }
      `;
      document.head.append(style);
    }

    if (input.dataset.calendarClickBound !== "true") {
      input.dataset.calendarClickBound = "true";
      input.addEventListener("pointerdown", (event) => {
        const rect = input.getBoundingClientRect();
        if (event.clientX < rect.right - 38) return;
        event.preventDefault();
        try { input.showPicker?.(); } catch (_error) { input.focus(); }
      });
    }
    return true;
  }

  const start = () => {
    install();
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (install() || attempts >= 40) window.clearInterval(timer);
    }, 100);
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();