(() => {
  if (window.__bpsCalendarControlStarted) return;
  window.__bpsCalendarControlStarted = true;

  const STYLE_ID = "authoritative-calendar-control-styles";
  const BUTTON_ID = "requiredDateCalendarButton";
  const PANEL_ID = "requiredDateCalendarPanel";
  const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  let visibleMonth = null;

  function parseIso(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function toIso(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function sameDay(left, right) {
    return Boolean(left && right)
      && left.getFullYear() === right.getFullYear()
      && left.getMonth() === right.getMonth()
      && left.getDate() === right.getDate();
  }

  function dateWithinLimits(date, input) {
    const min = parseIso(input.min);
    const max = parseIso(input.max);
    if (min && date < min) return false;
    if (max && date > max) return false;
    return true;
  }

  function installStyles() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.head.append(style);
    }

    style.textContent = `
      .order-form-page .sheet-field-row:has(>#requiredDate){
        position:relative!important;
        z-index:1!important;
        overflow:visible!important;
      }
      .order-form-page .sheet-field-row:has(>#requiredDateCalendarButton[aria-expanded="true"]){
        z-index:100005!important;
      }
      .order-form-page .sheet-field-row:has(>#requiredDate)::after{
        display:none!important;
        content:none!important;
      }
      .order-form-page .sheet-details-grid #requiredDate{
        box-sizing:border-box!important;
        width:100%!important;
        height:38px!important;
        min-height:38px!important;
        margin:0!important;
        padding:0 44px 0 10px!important;
        border:0!important;
        border-radius:0!important;
        outline:0!important;
        background:#fff!important;
        color:#17211f!important;
        font:400 11px/1.2 Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;
      }
      .order-form-page .sheet-details-grid #requiredDate:focus,
      .order-form-page .sheet-details-grid #requiredDate:focus-visible{
        position:relative!important;
        z-index:2!important;
        box-shadow:inset 0 0 0 1px var(--bell-green,#006557)!important;
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
      #${BUTTON_ID}{
        position:absolute!important;
        z-index:5!important;
        top:0!important;
        right:0!important;
        display:grid!important;
        place-items:center!important;
        width:38px!important;
        min-width:38px!important;
        height:38px!important;
        margin:0!important;
        padding:0!important;
        border:0!important;
        border-left:1px solid #d5dcda!important;
        border-radius:0!important;
        outline:0!important;
        background:#fff!important;
        cursor:pointer!important;
        box-sizing:border-box!important;
      }
      #${BUTTON_ID} img{
        display:block!important;
        width:12px!important;
        height:12px!important;
        pointer-events:none!important;
      }
      #${BUTTON_ID}:hover{background:#f5f8f7!important}
      #${BUTTON_ID}:focus-visible,
      #${BUTTON_ID}[aria-expanded="true"]{
        box-shadow:inset 0 0 0 1px var(--bell-green,#006557)!important;
      }
      #${PANEL_ID}{
        position:absolute!important;
        z-index:100004!important;
        top:100%!important;
        right:0!important;
        width:258px!important;
        margin:0!important;
        padding:10px!important;
        border:1px solid #cfd7d4!important;
        border-radius:0 0 4px 4px!important;
        background:#fff!important;
        box-shadow:0 10px 24px rgba(23,33,31,.16)!important;
        box-sizing:border-box!important;
        color:#17211f!important;
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;
      }
      #${PANEL_ID}[hidden]{display:none!important}
      #${PANEL_ID}::before,
      #${PANEL_ID}::after{
        content:none!important;
        display:none!important;
      }
      .portal-calendar-header{
        position:relative!important;
        z-index:1!important;
        display:grid!important;
        grid-template-columns:32px minmax(0,1fr) 32px!important;
        align-items:center!important;
        gap:4px!important;
        height:32px!important;
        margin:0 0 6px!important;
      }
      .portal-calendar-month{
        overflow:hidden!important;
        color:#17211f!important;
        font-size:11px!important;
        font-weight:700!important;
        line-height:1.2!important;
        text-align:center!important;
        text-overflow:ellipsis!important;
        white-space:nowrap!important;
      }
      .portal-calendar-nav{
        display:grid!important;
        place-items:center!important;
        width:32px!important;
        height:32px!important;
        margin:0!important;
        padding:0!important;
        border:0!important;
        border-radius:3px!important;
        background:#fff!important;
        color:#42514d!important;
        cursor:pointer!important;
        font:500 18px/1 Inter,system-ui,sans-serif!important;
      }
      .portal-calendar-nav:hover,.portal-calendar-nav:focus-visible{
        outline:0!important;
        background:#eef6f3!important;
      }
      .portal-calendar-weekdays,.portal-calendar-grid{
        display:grid!important;
        grid-template-columns:repeat(7,minmax(0,1fr))!important;
        gap:2px!important;
      }
      .portal-calendar-weekdays{margin-bottom:3px!important}
      .portal-calendar-weekdays span{
        display:grid!important;
        place-items:center!important;
        height:24px!important;
        color:#687471!important;
        font-size:9px!important;
        font-weight:600!important;
        line-height:1!important;
      }
      .portal-calendar-day{
        display:grid!important;
        place-items:center!important;
        width:100%!important;
        height:28px!important;
        margin:0!important;
        padding:0!important;
        border:0!important;
        border-radius:3px!important;
        background:#fff!important;
        color:#17211f!important;
        cursor:pointer!important;
        font:500 10px/1 Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;
        font-variant-numeric:tabular-nums!important;
      }
      .portal-calendar-day:hover,.portal-calendar-day:focus-visible{
        outline:0!important;
        background:#eef6f3!important;
      }
      .portal-calendar-day.is-outside{color:#a2aaa8!important}
      .portal-calendar-day.is-today{box-shadow:inset 0 0 0 1px #9fb5ae!important}
      .portal-calendar-day.is-selected{
        background:var(--bell-green,#006557)!important;
        color:#fff!important;
        font-weight:700!important;
        box-shadow:none!important;
      }
      .portal-calendar-day:disabled{
        color:#c7cecc!important;
        background:#fff!important;
        cursor:not-allowed!important;
      }
      .portal-calendar-footer{
        display:flex!important;
        align-items:center!important;
        justify-content:space-between!important;
        gap:8px!important;
        margin:8px 0 0!important;
        padding:8px 0 0!important;
        border-top:1px solid #e2e7e5!important;
      }
      .portal-calendar-action{
        min-height:28px!important;
        margin:0!important;
        padding:0 8px!important;
        border:0!important;
        border-radius:3px!important;
        background:#fff!important;
        color:var(--bell-green,#006557)!important;
        cursor:pointer!important;
        font:600 10px/1 Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;
      }
      .portal-calendar-action:hover,.portal-calendar-action:focus-visible{
        outline:0!important;
        background:#eef6f3!important;
      }
      @media(max-width:760px){
        #${PANEL_ID}{width:min(258px,calc(100vw - 32px))!important}
      }
    `;
  }

  function renderCalendar(input, panel) {
    const selected = parseIso(input.value);
    const today = new Date();
    const month = visibleMonth || startOfMonth(selected || today);
    visibleMonth = startOfMonth(month);

    const monthLabel = panel.querySelector(".portal-calendar-month");
    if (monthLabel) {
      monthLabel.textContent = new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric" }).format(visibleMonth);
    }

    const grid = panel.querySelector(".portal-calendar-grid");
    if (!grid) return;
    grid.replaceChildren();

    const mondayOffset = (visibleMonth.getDay() + 6) % 7;
    const firstVisible = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1 - mondayOffset);

    for (let index = 0; index < 42; index += 1) {
      const date = new Date(firstVisible.getFullYear(), firstVisible.getMonth(), firstVisible.getDate() + index);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "portal-calendar-day";
      button.textContent = String(date.getDate());
      button.dataset.date = toIso(date);
      button.setAttribute("aria-label", new Intl.DateTimeFormat("en-AU", { dateStyle: "full" }).format(date));
      button.classList.toggle("is-outside", date.getMonth() !== visibleMonth.getMonth());
      button.classList.toggle("is-today", sameDay(date, today));
      button.classList.toggle("is-selected", sameDay(date, selected));
      button.disabled = !dateWithinLimits(date, input);
      button.addEventListener("click", () => {
        input.value = button.dataset.date || "";
        input.classList.toggle("has-date-value", Boolean(input.value));
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        closeCalendar(input, panel, true);
      });
      grid.append(button);
    }
  }

  function openCalendar(input, button, panel) {
    visibleMonth = startOfMonth(parseIso(input.value) || new Date());
    renderCalendar(input, panel);
    panel.hidden = false;
    button.setAttribute("aria-expanded", "true");
    const selected = panel.querySelector(".portal-calendar-day.is-selected:not(:disabled)");
    const today = panel.querySelector(".portal-calendar-day.is-today:not(:disabled)");
    (selected || today || panel.querySelector(".portal-calendar-day:not(:disabled)"))?.focus({ preventScroll: true });
  }

  function closeCalendar(input, panel, restoreFocus = false) {
    panel.hidden = true;
    const button = document.getElementById(BUTTON_ID);
    button?.setAttribute("aria-expanded", "false");
    if (restoreFocus) button?.focus({ preventScroll: true });
    input.classList.toggle("has-date-value", Boolean(input.value));
  }

  function install() {
    const input = document.getElementById("requiredDate");
    if (!(input instanceof HTMLInputElement)) return false;
    const row = input.parentElement;
    if (!(row instanceof HTMLElement)) return false;

    installStyles();
    input.dataset.authoritativeCalendarControl = "true";
    document.querySelectorAll(`#${BUTTON_ID},#${PANEL_ID}`).forEach((element) => element.remove());

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.setAttribute("aria-label", "Choose required date");
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-expanded", "false");
    button.title = "Choose required date";
    button.innerHTML = '<img src="/calendar.svg?v=20260731-4" alt="">';

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Choose required date");
    panel.innerHTML = `
      <div class="portal-calendar-header">
        <button type="button" class="portal-calendar-nav" data-calendar-previous aria-label="Previous month">‹</button>
        <div class="portal-calendar-month" aria-live="polite"></div>
        <button type="button" class="portal-calendar-nav" data-calendar-next aria-label="Next month">›</button>
      </div>
      <div class="portal-calendar-weekdays" aria-hidden="true">${WEEKDAYS.map((day) => `<span>${day}</span>`).join("")}</div>
      <div class="portal-calendar-grid"></div>
      <div class="portal-calendar-footer">
        <button type="button" class="portal-calendar-action" data-calendar-clear>Clear</button>
        <button type="button" class="portal-calendar-action" data-calendar-today>Today</button>
      </div>
    `;

    row.append(button, panel);

    button.addEventListener("click", () => {
      if (panel.hidden) openCalendar(input, button, panel);
      else closeCalendar(input, panel, true);
    });

    panel.querySelector("[data-calendar-previous]")?.addEventListener("click", () => {
      visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
      renderCalendar(input, panel);
    });
    panel.querySelector("[data-calendar-next]")?.addEventListener("click", () => {
      visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
      renderCalendar(input, panel);
    });
    panel.querySelector("[data-calendar-clear]")?.addEventListener("click", () => {
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      closeCalendar(input, panel, true);
    });
    panel.querySelector("[data-calendar-today]")?.addEventListener("click", () => {
      const today = new Date();
      if (!dateWithinLimits(today, input)) return;
      input.value = toIso(today);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      closeCalendar(input, panel, true);
    });

    panel.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCalendar(input, panel, true);
      }
    });
    document.addEventListener("pointerdown", (event) => {
      if (panel.hidden || row.contains(event.target)) return;
      closeCalendar(input, panel);
    }, true);
    window.addEventListener("resize", () => closeCalendar(input, panel));
    window.addEventListener("scroll", () => closeCalendar(input, panel), true);

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