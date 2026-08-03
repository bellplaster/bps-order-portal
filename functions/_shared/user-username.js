export const PORTAL_USERNAME_MIN_LENGTH = 2;
export const PORTAL_USERNAME_MAX_LENGTH = 80;
export const PORTAL_USERNAME_PATTERN = /^[a-z0-9._-]{2,80}$/;
export const PORTAL_USERNAME_ERROR = "Username must be 2–80 characters using letters, numbers, dots, underscores or dashes.";

export function normalisePortalUsername(value) {
  const username = String(value || "").trim().toLowerCase();
  if (!PORTAL_USERNAME_PATTERN.test(username)) {
    throw new Error(PORTAL_USERNAME_ERROR);
  }
  return username;
}
