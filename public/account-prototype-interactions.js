(() => {
  if (window.__bpsAccountPrototypeInteractionsStarted) return;
  window.__bpsAccountPrototypeInteractionsStarted = true;

  const messageReplacements = new Map([
    ["Saved contact added.", "Contact saved"],
    ["Saved contact updated.", "Contact updated"],
    ["Saved contact removed.", "Contact removed"],
    ["Password changed.", "Password updated"],
  ]);

  let confirmResolver = null;
  let passwordDialog = null;

  function installConfirmDialog() {
    if (document.getElementById("accountPrototypeConfirmDialog")) return;

    const dialog = document.createElement("dialog");
    dialog.id = "accountPrototypeConfirmDialog";
    dialog.className = "account-prototype-dialog";
    dialog.innerHTML = `
      <form class="account-prototype-dialog-card" method="dialog">
        <div class="account-prototype-confirm-copy">
          <h2 id="accountPrototypeConfirmTitle">Confirm action</h2>
          <p id="accountPrototypeConfirmMessage"></p>
        </div>
        <footer>
          <button class="account-prototype-cancel" type="button" data-confirm-cancel>Cancel</button>
          <button class="button account-prototype-danger" type="submit" value="confirm" id="accountPrototypeConfirmSubmit">Remove</button>
        </footer>
      </form>`;
    document.body.append(dialog);

    const settle = (value) => {
      const resolve = confirmResolver;
      confirmResolver = null;
      if (dialog.open) dialog.close();
      resolve?.(value);
    };

    dialog.querySelector("[data-confirm-cancel]")?.addEventListener("click", () => settle(false));
    dialog.querySelector("form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      settle(true);
    });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      settle(false);
    });
    dialog.addEventListener("close", () => {
      if (confirmResolver) settle(false);
    });
  }

  function confirmAction(options = {}) {
    installConfirmDialog();
    const dialog = document.getElementById("accountPrototypeConfirmDialog");
    if (!dialog) return Promise.resolve(window.confirm(options.message || "Continue?"));

    if (confirmResolver) {
      confirmResolver(false);
      confirmResolver = null;
    }

    document.getElementById("accountPrototypeConfirmTitle").textContent = options.title || "Confirm action";
    document.getElementById("accountPrototypeConfirmMessage").textContent = options.message || "This action cannot be undone.";
    document.getElementById("accountPrototypeConfirmSubmit").textContent = options.confirmLabel || "Remove";

    return new Promise((resolve) => {
      confirmResolver = resolve;
      typeof dialog.showModal === "function" ? dialog.showModal() : dialog.setAttribute("open", "");
      requestAnimationFrame(() => dialog.querySelector("[data-confirm-cancel]")?.focus());
    });
  }

  window.BPSAccountDialogs = {
    ...(window.BPSAccountDialogs || {}),
    confirm: confirmAction,
  };

  function buildPasswordDialog() {
    if (passwordDialog) return passwordDialog;
    const form = document.getElementById("passwordForm");
    const panel = document.getElementById("passwordPanel");
    const toggle = document.getElementById("togglePasswordPanel");
    if (!form || !panel || !toggle) return null;

    document.getElementById("currentPassword")?.closest(".account-field")?.classList.add("current-password-field");
    document.getElementById("newPassword")?.closest(".account-field")?.classList.add("new-password-field");
    document.getElementById("confirmPassword")?.closest(".account-field")?.classList.add("confirm-password-field");

    const dialog = document.createElement("dialog");
    dialog.id = "passwordDialogV2";
    dialog.className = "account-prototype-dialog password-dialog-v2";

    const card = document.createElement("div");
    card.className = "account-prototype-dialog-card";
    card.innerHTML = `
      <header>
        <div>
          <h2>Change password</h2>
          <p>Use at least eight characters and avoid reusing an existing password.</p>
        </div>
        <button class="account-prototype-dialog-close" type="button" aria-label="Close password dialog">×</button>
      </header>`;

    form.classList.add("password-modal-form-v2");
    card.append(form);
    dialog.append(card);
    document.body.append(dialog);

    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    const action = toggle.querySelector("b");
    if (action) action.textContent = "Change password";

    const close = () => {
      if (dialog.open && typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
      toggle.setAttribute("aria-expanded", "false");
      form.reset();
    };

    const open = () => {
      if (!dialog.open) {
        typeof dialog.showModal === "function" ? dialog.showModal() : dialog.setAttribute("open", "");
      }
      toggle.setAttribute("aria-expanded", "true");
      requestAnimationFrame(() => document.getElementById("currentPassword")?.focus());
    };

    const toggleDialog = (force) => {
      const shouldOpen = typeof force === "boolean" ? force : !dialog.open;
      shouldOpen ? open() : close();
    };

    window.togglePasswordPanel = toggleDialog;
    window.BPSAccountDialogs.password = { open, close };

    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      open();
    }, true);

    dialog.querySelector(".account-prototype-dialog-close")?.addEventListener("click", close);
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      close();
    });
    document.getElementById("cancelPasswordChange")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    }, true);

    passwordDialog = dialog;
    return dialog;
  }

  function installPasswordDialog() {
    if (buildPasswordDialog()) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (buildPasswordDialog() || attempts >= 60) window.clearInterval(timer);
    }, 100);
  }

  function installMessageRefinements() {
    const root = document.getElementById("accountMessage");
    if (!root || root.dataset.prototypeMessageRefinement === "true") return;
    root.dataset.prototypeMessageRefinement = "true";

    let normalising = false;
    const sync = () => {
      if (normalising || root.hidden) return;
      const current = (root.textContent || "").trim();
      const replacement = messageReplacements.get(current);
      if (replacement && replacement !== current) {
        normalising = true;
        root.textContent = replacement;
        normalising = false;
      }
      if ((root.textContent || "").trim() === "Password updated") {
        window.BPSAccountDialogs?.password?.close?.();
      }
    };

    const observer = new MutationObserver(() => queueMicrotask(sync));
    observer.observe(root, {
      attributes:true,
      attributeFilter:["hidden"],
      childList:true,
      characterData:true,
      subtree:true,
    });
    sync();
  }

  function start() {
    installConfirmDialog();
    installPasswordDialog();
    installMessageRefinements();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
