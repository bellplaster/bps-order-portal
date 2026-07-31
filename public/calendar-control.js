(() => {
  if (window.__bpsCalendarControlStarted) return;
  window.__bpsCalendarControlStarted = true;

  const STYLE_ID = "authoritative-calendar-control-styles";

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
        background-color:#fff!important;
        background-image:url('/calendar.svg?v=20260731-3')!important;
        background-repeat:no-repeat!important;
        background-position:center!important;
        background-size:15px 15px!important;
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
      }
      .order-form-page .sheet-details-grid #requiredDate::-webkit-calendar-picker-indicator{
        position:absolute!important;
        z-index:4!important;
        top:0!important;
        right:0!important;
        display:block!important;
        width:38px!important;
        height:38px!important;
        margin:0!important;
        padding:0!important;
        opacity:0!important;
        cursor:pointer!important;
      }
    `;

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