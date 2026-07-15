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
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        password: document.getElementById("password").value,
      }),
    });

    const result = await response.json().catch(() => ({
      ok: false,
      error: "The sign-in service returned an unreadable response.",
    }));

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Incorrect password.");
    }

    window.location.replace("/");
  } catch (error) {
    message.textContent = error.message || String(error);
    message.className = "message message-error";
    message.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = "Sign in";
  }
});
