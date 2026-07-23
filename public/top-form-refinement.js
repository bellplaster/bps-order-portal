(() => {
  const originalFieldError = window.fieldError;
  if (typeof originalFieldError === "function") {
    window.fieldError = function refinedFieldError(id, message) {
      const refinedMessage = id === "reference" ? "Enter the order number." : message;
      return originalFieldError.call(this, id, refinedMessage);
    };
  }

  const originalShowGlobal = window.showGlobal;
  if (typeof originalShowGlobal === "function") {
    window.showGlobal = function refinedShowGlobal(message, type) {
      const refinedMessage = message === "Enter the customer order reference."
        ? "Enter the order number."
        : message;
      return originalShowGlobal.call(this, refinedMessage, type);
    };
  }
})();