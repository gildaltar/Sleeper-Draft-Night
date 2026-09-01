import { LEAGUE_ID } from "./config";
import { supabase } from "./supabase";

export async function teamAccess(action,rosterId,extra = {}) {
  const result = await supabase.functions.invoke("team-access",{
    body:{action,leagueId:LEAGUE_ID,rosterId:Number(rosterId),...extra},
  });
  let data = result.data;
  if (result.error && !data && result.error.context?.json) {
    try { data = await result.error.context.json(); }
    catch { /* Keep the original function error. */ }
  }
  if (result.error && !data?.error) throw result.error;
  if (!data?.ok) throw new Error(data?.error || result.error?.message || "Team access failed");
  return data;
}
