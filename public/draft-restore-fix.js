(() => {
  let attempts = 0;
  let restored = false;

  function restoreCurrentDraftAfterDeliverySetup() {
    if (restored) return true;

    const deliverySelect = document.querySelector('.delivery-select-deliveryType .delivery-select');
    const managerReady = document.querySelector('script[data-manager-refinement="true"]');
    if (!deliverySelect || !managerReady || typeof restoreDraft !== 'function') return false;

    restored = true;
    restoreDraft();

    window.setTimeout(() => {
      if (typeof syncDeliverySelect === 'function') syncDeliverySelect();
      if (typeof updatePickupMode === 'function') updatePickupMode();
      if (typeof updateGeneratedDeliverySummary === 'function') updateGeneratedDeliverySummary();
    }, 0);

    return true;
  }

  const timer = window.setInterval(() => {
    attempts += 1;
    if (restoreCurrentDraftAfterDeliverySetup() || attempts >= 100) {
      window.clearInterval(timer);
    }
  }, 100);

  document.addEventListener('DOMContentLoaded', restoreCurrentDraftAfterDeliverySetup, { once: true });
})();
