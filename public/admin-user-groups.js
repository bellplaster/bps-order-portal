(() => {
  if (document.querySelector('script[data-admin-user-management="true"]')) return;
  const script = document.createElement("script");
  script.src = "/admin-user-management.js?v=20260730-2";
  script.defer = true;
  script.dataset.adminUserManagement = "true";
  document.body.append(script);
})();
