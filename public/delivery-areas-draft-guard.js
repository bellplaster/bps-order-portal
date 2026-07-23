(() => {
  state.deliveryAreaDraftReady = false;
  const originalScheduleDraft = scheduleDraft;
  scheduleDraft = function scheduleDraftAfterAreaRestore(...args) {
    if (!state.deliveryAreaDraftReady) return;
    return originalScheduleDraft.apply(this, args);
  };

  const originalRestoreDraft = restoreDraft;
  restoreDraft = function restoreDeliveryAreaDraft(...args) {
    try {
      return originalRestoreDraft.apply(this, args);
    } finally {
      state.deliveryAreaDraftReady = true;
    }
  };
})();