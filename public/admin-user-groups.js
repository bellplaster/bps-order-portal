(() => {
  if (document.querySelector('script[data-admin-user-management-v2="true"]')) return;
  const script = document.createElement("script");
  script.src = "/admin-user-management-v2.js?v=20260730-1";
  script.defer = true;
  script.dataset.adminUserManagementV2 = "true";
  document.body.append(script);
})();
