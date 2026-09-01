import { PUBLIC_SITE_URL } from "./config";

export const OWNER_AUTH_RETURN_KEY = "sdn-owner-auth-return";

export function ownerTeamPath(rosterId) {
  const team = Math.max(1,Number(rosterId) || 1);
  return `/team?team=${team}`;
}

export function ownerMagicLinkRedirect(rosterId) {
  const url = new URL("/auth/callback",PUBLIC_SITE_URL);
  url.searchParams.set("team",String(Math.max(1,Number(rosterId) || 1)));
  return url.toString();
}
