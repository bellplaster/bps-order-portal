(() => {
  const ORDERS_URL = "/orders/";

  function replaceButtonWithLink(id, label, className) {
    const control = document.getElementById(id);
    if (!control) return;
    const link = document.createElement("a");
    link.className = className || control.className;
    link.href = ORDERS_URL;
    link.textContent = label;
    control.replaceWith(link);
  }

  function installOrdersNavigation() {
    replaceButtonWithLink("openHistoryButton", "Orders", "header-button");
    replaceButtonWithLink("viewHistoryButton", "View order history", "button button-secondary");

    document.getElementById("historyBackdrop")?.remove();
    document.getElementById("historyDrawer")?.remove();

    window.openHistory = () => window.location.assign(ORDERS_URL);
    window.closeHistory = () => {};
    window.loadOrderHistory = async () => {};
  }

  installOrdersNavigation();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installOrdersNavigation, { once: true });
  }
})();
