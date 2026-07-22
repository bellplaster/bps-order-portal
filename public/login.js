// Preview deployments must be rebuilt after Cloudflare secrets change.
const form = document.getElementById("loginForm");
const button = document.getElementById("loginButton");
const message = document.getElementById("loginMessage");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.hidden = true;
  button.disabled = true;
  button.textContent = "Signing in…";
  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        username: document.getElementById("username").value.trim(),
        password: document.getElementById("password").value,
      }),
    });
    const result = await response.json().catch(() => ({ ok: false, error: "The server returned an unreadable response." }));
    if (!response.ok || !result.ok) throw new Error(result.error || "Sign in failed.");
    window.location.replace("/");
  } catch (error) {
    message.textContent = error.message || String(error);
    message.className = "portal-message is-error";
    message.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = "Sign in";
  }
});
