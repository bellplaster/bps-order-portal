(() => {
  document.addEventListener("DOMContentLoaded", initialiseAdminEmailTest, { once: true });

  function initialiseAdminEmailTest() {
    const button = document.getElementById("sendAdminEmailTest");
    if (!button) return;
    button.addEventListener("click", sendTestEmail);
  }

  async function sendTestEmail() {
    const button = document.getElementById("sendAdminEmailTest");
    const status = document.getElementById("adminEmailTestStatus");
    if (!button || !status || button.disabled) return;

    const originalLabel = button.textContent;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = "Sending…";
    setStatus(status, "Sending one test email through Cloudflare…", "pending");

    try {
      const response = await fetch("/api/admin-email-test", {
        method: "POST",
        headers: { "Accept": "application/json" },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        const detail = result.detail ? ` ${result.detail}` : "";
        throw new Error(`${result.error || `Email test failed (${response.status}).`}${detail}`.trim());
      }

      const messageId = result.messageId ? ` Message ID: ${result.messageId}.` : "";
      setStatus(status, `Test email sent to ${result.recipient}.${messageId}`, "success");
    } catch (error) {
      setStatus(status, error?.message || String(error), "error");
    } finally {
      button.disabled = false;
      button.removeAttribute("aria-busy");
      button.textContent = originalLabel;
    }
  }

  function setStatus(element, message, state) {
    element.textContent = message;
    element.dataset.state = state;
  }
})();
