import { LEAGUE_ID } from "./config";
import { supabase } from "./supabase";

const teamSessionKey = (rosterId) => `sdn-team-password-session-v1-${LEAGUE_ID}-${Number(rosterId)}`;
export function clearTeamSession(rosterId) {
  try {window.localStorage.removeItem(teamSessionKey(rosterId));} catch { /* Storage can be unavailable. */ }
}
export function hasTeamSession(rosterId) {
  try {return Boolean(window.localStorage.getItem(teamSessionKey(rosterId)));} catch {return false;}
}
export function getTeamSessionToken(rosterId) {
  try {return window.localStorage.getItem(teamSessionKey(rosterId)) || "";} catch {return "";}
}
export async function signOutTeamSession(rosterId) {
  try {if (hasTeamSession(rosterId)) await teamAccess("password-logout",rosterId);} finally {clearTeamSession(rosterId);}
}

export async function teamAccess(action,rosterId,extra = {}) {
  let teamToken = "";
  try {teamToken = window.localStorage.getItem(teamSessionKey(rosterId)) || "";} catch { /* Storage can be unavailable. */ }
  const result = await supabase.functions.invoke("team-access",{
    body:{action,leagueId:LEAGUE_ID,rosterId:Number(rosterId),...extra},
    headers:teamToken ? {"x-team-access-token":teamToken} : undefined,
  });
  let data = result.data;
  if (result.error && !data && result.error.context?.json) {
    try { data = await result.error.context.json(); }
    catch { /* Keep the original function error. */ }
  }
  if (result.error && !data?.error) throw result.error;
  if (!data?.ok) {
    if (teamToken && (action === "session" || String(data?.error || "").includes("session expired"))) {
      clearTeamSession(rosterId);
      window.dispatchEvent(new CustomEvent("sdn:team-session-expired",{detail:{rosterId:Number(rosterId)}}));
    }
    throw new Error(data?.error || result.error?.message || "Team access failed");
  }
  if (action === "password-login" && data.token) {
    try {window.localStorage.setItem(teamSessionKey(rosterId),data.token);} catch {
      await supabase.functions.invoke("team-access",{body:{action:"password-logout",leagueId:LEAGUE_ID,rosterId:Number(rosterId)},headers:{"x-team-access-token":data.token}});
      throw new Error("This browser blocked local storage. Allow site storage to stay signed in.");
    }
  }
  return data;
}
