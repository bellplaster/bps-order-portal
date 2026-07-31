(() => {
  if (window.__bpsCalendarControlStarted) return;
  window.__bpsCalendarControlStarted = true;

  const STYLE_ID = "authoritative-calendar-control-styles";

  function openPicker(input) {
    try {
      if (typeof input.showPicker === "function") input.showPicker();
      else input.focus({ preventScroll: true });
    } catch (_error) {
      input.focus({ preventScroll: true });
    }
  }

  function install() {
    const input = document.getElementById("requiredDate");
    if (!(input instanceof HTMLInputElement)) return false;

    input.dataset.authoritativeCalendarControl = "true";

    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.head.append(style);
    }

    style.textContent = `
      .order-form-page .sheet-field-row:has(>#requiredDate){
        position:relative!important;
      }
      .order-form-page .sheet-field-row:has(>#requiredDate)::after{
        content:""!important;
        display:block!important;
        position:absolute!important;
        z-index:3!important;
        top:0!important;
        right:0!important;
        width:38px!important;
        height:38px!important;
        box-sizing:border-box!important;
        border-left:1px solid #d5dcda!important;
        background:#fff url('/calendar.svg?v=20260731-4') center/15px 15px no-repeat!important;
        pointer-events:none!important;
        opacity:1!important;
        visibility:visible!important;
        transform:none!important;
      }
      .order-form-page .sheet-details-grid #requiredDate{
        box-sizing:border-box!important;
        width:100%!important;
        height:38px!important;
        min-height:38px!important;
        padding:0 44px 0 10px!important;
        background:#fff!important;
        cursor:text!important;
      }
      .order-form-page .sheet-details-grid #requiredDate::-webkit-calendar-picker-indicator{
        display:none!important;
        width:0!important;
        height:0!important;
        margin:0!important;
        padding:0!important;
        opacity:0!important;
        pointer-events:none!important;
      }
    `;

    if (input.dataset.calendarTriggerBound !== "true") {
      input.dataset.calendarTriggerBound = "true";
      input.addEventListener("pointerdown", (event) => {
        const rect = input.getBoundingClientRect();
        if (event.clientX < rect.right - 38) return;
        event.preventDefault();
        event.stopPropagation();
        openPicker(input);
      }, true);
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        if (document.activeElement !== input) return;
        event.preventDefault();
        openPicker(input);
      });
    }

    return true;
  }

  const start = () => {
    if (install()) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (install() || attempts >= 30) window.clearInterval(timer);
    }, 100);
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();