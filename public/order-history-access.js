(() => {
  if (document.querySelector('script[data-orders-navigation="true"]')) return;
  const script = document.createElement("script");
  script.src = "/orders-navigation.js?v=20260803-1";
  script.dataset.ordersNavigation = "true";
  document.body.append(script);
})();
