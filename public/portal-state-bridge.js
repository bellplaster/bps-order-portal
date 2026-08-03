(() => {
  try {
    if (typeof state !== "undefined") globalThis.state = state;
  } catch (_error) {
    // The confirmation route can still load from the server without client state.
  }
})();
