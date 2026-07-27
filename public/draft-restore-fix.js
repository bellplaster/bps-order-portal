(() => {
  let attempts = 0;
  let restored = false;

  function ensureEditBannerMarkup() {
    const banner = document.getElementById('editModeBanner');
    if (!banner || banner.childElementCount) return;
    banner.innerHTML = '<div><span>Editing</span> <strong id="editOrderNumber"></strong> <small id="editRevisionText"></small></div><button id="cancelEditButton" class="text-button" type="button">Cancel edit</button>';
    document.getElementById('cancelEditButton')?.addEventListener('click', () => {
      if (typeof resetOrder === 'function') resetOrder();
    });
  }

  function restoreCurrentDraftAfterDeliverySetup() {
    ensureEditBannerMarkup();
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
