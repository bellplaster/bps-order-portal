(() => {
  if (document.querySelector('script[data-order-defaults="true"]')) return;
  const script = document.createElement("script");
  script.src = "/order-defaults.js?v=20260728-2";
  script.defer = true;
  script.dataset.orderDefaults = "true";
  document.body.append(script);
})();