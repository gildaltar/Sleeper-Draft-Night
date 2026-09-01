import { CheckCircle2, LoaderCircle, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { OWNER_AUTH_RETURN_KEY, ownerTeamPath } from "../lib/authRedirect";
import { supabase } from "../lib/supabase";

export default function AuthCallback({rosterId}) {
  const [state,setState] = useState("checking");
  const [message,setMessage] = useState("Securing your team-owner session…");
  const destination = useMemo(() => {
    try { return window.sessionStorage.getItem(OWNER_AUTH_RETURN_KEY) || ownerTeamPath(rosterId); }
    catch { return ownerTeamPath(rosterId); }
  },[rosterId]);

  useEffect(() => {
    let active = true;
    let redirected = false;
    const hash = new URLSearchParams(window.location.hash.replace(/^#/,""));
    const query = new URLSearchParams(window.location.search);
    const authError = hash.get("error_description") || query.get("error_description");
    const finish = () => {
      if (!active || redirected) return;
      redirected = true;
      setState("ready");
      setMessage("Signed in. Opening your team…");
      try { window.sessionStorage.removeItem(OWNER_AUTH_RETURN_KEY); } catch { /* Storage can be unavailable. */ }
      window.setTimeout(() => window.location.replace(destination),250);
    };
    if (authError) {
      setState("error");setMessage(authError);
      return () => { active = false; };
    }
    const {data:listener} = supabase.auth.onAuthStateChange((_event,session) => { if (session) finish(); });
    supabase.auth.getSession().then(({data,error}) => {
      if (!active) return;
      if (error) throw error;
      if (data.session) finish();
      else window.setTimeout(() => {
        if (active && !redirected) {setState("error");setMessage("This sign-in link is invalid or expired. Return to the team page and request a new link.");}
      },6500);
    }).catch((error) => {if (active) {setState("error");setMessage(error.message || "Could not finish sign-in");}});
    return () => {active = false;listener.subscription.unsubscribe();};
  },[destination]);

  const Icon = state === "error" ? ShieldAlert : state === "ready" ? CheckCircle2 : LoaderCircle;
  return <main className={`loading-screen auth-callback state-${state}`}><Icon className={state === "checking" ? "spin" : ""}/><span>TEAM OWNER SIGN-IN</span><h1>{message}</h1>{state === "error" && <a href={destination}>Return to team sign-in</a>}</main>;
}
