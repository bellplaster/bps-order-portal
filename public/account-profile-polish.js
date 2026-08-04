(() => {
  if (window.__bpsAccountProfilePolishStarted) return;
  window.__bpsAccountProfilePolishStarted = true;

  const DESCRIPTION = "Manage your ordering preferences, contacts and delivery details.";

  function applyProfilePolish() {
    const card = document.getElementById("accountProfileV2");
    if (!card) return false;

    card.querySelector(".account-profile-avatar-v2")?.remove();
    card.querySelector(".account-profile-meta-v2")?.remove();

    const role = card.querySelector(".account-profile-role-v2");
    const description = card.querySelector(".account-profile-copy-v2 p");
    if (description && role?.textContent?.trim() === "Customer account") {
      description.textContent = DESCRIPTION;
    }

    card.dataset.profilePolished = "true";
    return true;
  }

  function start() {
    if (applyProfilePolish()) return;

    const onReady = () => {
      if (applyProfilePolish()) document.removeEventListener("bps:account-loaded", onReady);
    };
    document.addEventListener("bps:account-loaded", onReady);

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (applyProfilePolish() || attempts >= 50) window.clearInterval(timer);
    }, 100);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
