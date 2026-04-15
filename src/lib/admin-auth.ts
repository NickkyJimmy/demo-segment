export const ADMIN_AUTH_COOKIE = "admin_auth";
const ADMIN_AUTH_COOKIE_VALUE = "1";

export const FIXED_ADMIN_USERNAME = "admin";
export const FIXED_ADMIN_PASSWORD = "admin";

export function isValidAdminCredentials(username: string, password: string) {
  return username === FIXED_ADMIN_USERNAME && password === FIXED_ADMIN_PASSWORD;
}

export function isAdminAuthenticatedValue(cookieValue: string | undefined) {
  return cookieValue === ADMIN_AUTH_COOKIE_VALUE;
}

export function buildAdminSessionCookie() {
  return {
    name: ADMIN_AUTH_COOKIE,
    value: ADMIN_AUTH_COOKIE_VALUE,
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    },
  };
}

export function normalizeAdminNextPath(nextRaw: string | null | undefined) {
  if (!nextRaw || !nextRaw.startsWith("/")) return "/admin";
  if (nextRaw.startsWith("//")) return "/admin";
  if (!nextRaw.startsWith("/admin")) return "/admin";
  return nextRaw;
}
