(() => {
  const IDLE_LIMIT_MS = 60 * 60 * 1000;
  const WARNING_WINDOW_MS = 5 * 60 * 1000;
  const STORAGE_KEY = "bps:last-active-at";
  const ACTIVITY_THROTTLE_MS = 10 * 1000;

  let lastRecordedActivity = readLastActivity();
  let lastWriteAt = 0;
  let warningVisible = false;
  let timerId = null;
  let signingOut = false;

  const activityEvents = ["pointerdown", "keydown", "input", "change", "touchstart"];

  function readLastActivity() {
    const value = Number(localStorage.getItem(STORAGE_KEY));
    if (Number.isFinite(value) && value > 0) return value;
    const now = Date.now();
    localStorage.setItem(STORAGE_KEY, String(now));
    return now;
  }

  function recordActivity() {
    if (warningVisible || signingOut) return;
    const now = Date.now();
    lastRecordedActivity = now;
    if (now - lastWriteAt >= ACTIVITY_THROTTLE_MS) {
      localStorage.setItem(STORAGE_KEY, String(now));
      lastWriteAt = now;
    }
  }

  function syncFromStorage(event) {
    if (event.key !== STORAGE_KEY) return;
    const value = Number(event.newValue);
    if (!Number.isFinite(value) || value <= 0) return;
    lastRecordedActivity = value;
    if (warningVisible && Date.now() - value < IDLE_LIMIT_MS - WARNING_WINDOW_MS) hideWarning();
  }

  function ensureWarning() {
    let backdrop = document.getElementById("sessionTimeoutBackdrop");
    if (backdrop) return backdrop;

    const style = document.createElement("style");
    style.textContent = `
      .session-timeout-backdrop{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(17,24,39,.42);backdrop-filter:blur(3px)}
      .session-timeout-card{width:min(440px,100%);background:#fff;border:1px solid rgba(17,24,39,.1);border-radius:18px;box-shadow:0 24px 80px rgba(17,24,39,.24);padding:28px;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111827}
      .session-timeout-card h2{margin:0 0 10px;font-size:22px;line-height:1.25;font-weight:650}
      .session-timeout-card p{margin:0;color:#4b5563;font-size:15px;line-height:1.55}
      .session-timeout-countdown{margin-top:18px;font-size:34px;line-height:1;font-weight:700;letter-spacing:-.03em;color:#111827;font-variant-numeric:tabular-nums}
      .session-timeout-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:24px}
      .session-timeout-actions button{min-height:42px;padding:0 16px;border-radius:10px;border:1px solid #d1d5db;background:#fff;color:#111827;font:600 14px/1 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer}
      .session-timeout-actions .session-timeout-primary{border-color:#a62b45;background:#a62b45;color:#fff}
      .session-timeout-actions button:focus-visible{outline:3px solid rgba(166,43,69,.22);outline-offset:2px}
      @media(max-width:520px){.session-timeout-card{padding:22px;border-radius:16px}.session-timeout-actions{flex-direction:column-reverse}.session-timeout-actions button{width:100%}}
    `;
    document.head.append(style);

    backdrop = document.createElement("div");
    backdrop.id = "sessionTimeoutBackdrop";
    backdrop.className = "session-timeout-backdrop";
    backdrop.hidden = true;
    backdrop.setAttribute("role", "presentation");
    backdrop.innerHTML = `
      <section class="session-timeout-card" role="alertdialog" aria-modal="true" aria-labelledby="sessionTimeoutTitle" aria-describedby="sessionTimeoutMessage">
        <h2 id="sessionTimeoutTitle">Your session is about to expire</h2>
        <p id="sessionTimeoutMessage">For your security, you’ll be signed out after 60 minutes of inactivity.</p>
        <div id="sessionTimeoutCountdown" class="session-timeout-countdown" aria-live="polite">5:00</div>
        <div class="session-timeout-actions">
          <button id="sessionTimeoutSignOut" type="button">Sign out</button>
          <button id="sessionTimeoutStaySignedIn" class="session-timeout-primary" type="button">Stay signed in</button>
        </div>
      </section>`;
    document.body.append(backdrop);

    document.getElementById("sessionTimeoutStaySignedIn")?.addEventListener("click", staySignedIn);
    document.getElementById("sessionTimeoutSignOut")?.addEventListener("click", () => signOut("manual"));
    return backdrop;
  }

  function showWarning() {
    const backdrop = ensureWarning();
    if (!warningVisible) {
      warningVisible = true;
      backdrop.hidden = false;
      document.getElementById("sessionTimeoutStaySignedIn")?.focus();
    }
  }

  function hideWarning() {
    warningVisible = false;
    const backdrop = document.getElementById("sessionTimeoutBackdrop");
    if (backdrop) backdrop.hidden = true;
  }

  function staySignedIn() {
    const now = Date.now();
    lastRecordedActivity = now;
    lastWriteAt = now;
    localStorage.setItem(STORAGE_KEY, String(now));
    hideWarning();
    tick();
  }

  function formatRemaining(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function tick() {
    if (signingOut) return;
    const elapsed = Date.now() - lastRecordedActivity;
    const remaining = IDLE_LIMIT_MS - elapsed;

    if (remaining <= 0) {
      signOut("timeout");
      return;
    }

    if (remaining <= WARNING_WINDOW_MS) {
      showWarning();
      const countdown = document.getElementById("sessionTimeoutCountdown");
      if (countdown) countdown.textContent = formatRemaining(remaining);
    } else if (warningVisible) {
      hideWarning();
    }
  }

  async function signOut(reason) {
    if (signingOut) return;
    signingOut = true;
    window.dispatchEvent(new CustomEvent("bps:session-ending", { detail: { reason } }));
    try {
      await fetch("/api/logout", { method: "POST", headers: { Accept: "application/json" }, keepalive: true });
    } catch (_error) {
      // Redirect regardless; the server will reject the expired session if the logout request fails.
    }
    localStorage.removeItem(STORAGE_KEY);
    const destination = reason === "timeout" ? "/signin/?reason=timeout" : "/signin/";
    window.location.replace(destination);
  }

  activityEvents.forEach((eventName) => {
    document.addEventListener(eventName, recordActivity, { capture: true, passive: eventName !== "keydown" });
  });
  window.addEventListener("storage", syncFromStorage);
  window.addEventListener("focus", () => {
    lastRecordedActivity = readLastActivity();
    tick();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      lastRecordedActivity = readLastActivity();
      tick();
    }
  });

  timerId = window.setInterval(tick, 1000);
  window.addEventListener("pagehide", () => window.clearInterval(timerId), { once: true });
  tick();
})();
