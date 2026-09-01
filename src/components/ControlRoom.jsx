import { AlertOctagon, ArrowLeft, ArrowLeftRight, BellRing, Clock3, ExternalLink, LogOut, Play, Plus, Save, Shield, Trash2, Trophy, Volume2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { LEAGUE_ID } from "../lib/config";
import { afterAuthLock, checkCommissioner } from "../lib/controlAuth";
import { supabase } from "../lib/supabase";
import PickOperator from "./PickOperator";

function Login({ onReady }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setMessage("");
    try {
      const result = await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      await onReady(result.data.session);
    } catch (requestError) {
      setMessage(requestError.message || "Could not open the control room");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="commissioner-login">
      <Shield />
      <span>SECURE CONTROL ROOM</span>
      <h1>Commissioner sign-in</h1>
      <p>Broadcast viewers and team owners never see these controls.</p>
      <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submit()} /></label>
      <button disabled={busy || !email || password.length < 6} onClick={submit}>{busy ? "Signing in…" : "Enter control room"}</button>
      {message && <div className="form-error">{message}</div>}
    </main>
  );
}

export default function ControlRoom({ control, bootstrap, live }) {
  const [session, setSession] = useState(null);
  const [authorized, setAuthorized] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [authIssue, setAuthIssue] = useState("");
  const [teamId, setTeamId] = useState("1");
  const [teamPassword, setTeamPassword] = useState("");
  const [teamName, setTeamName] = useState(bootstrap.members[0]?.teamName || "");
  const [overlay, setOverlay] = useState({ type:"announcement", kicker:"COMMISSIONER UPDATE", title:"Draft room announcement", detail:"Stand by for an update from the commissioner.", duration:7, sound:"alert" });
  const [ticker, setTicker] = useState({ lane:"bottom", kind:"news", text:"", accent:"#b8ff38" });

  const verifyCommissioner = useCallback(async (active) => {
    if (!active) { setSession(null); setAuthorized(false); setReady(true); return; }
    const isAuthorized = await checkCommissioner(supabase, active);
    setSession(active);
    setAuthorized(isAuthorized);
    setReady(true);
    setAuthIssue("");
  }, []);

  useEffect(() => {
    let mounted = true;
    let recoveryTimer = window.setTimeout(() => {
      if (!mounted) return;
      setReady(true);
      setAuthIssue("The saved sign-in session took too long to open. You can retry it without clearing site data.");
    }, 7000);

    const applySession = async (next) => {
      try {
        await verifyCommissioner(next);
      } catch (requestError) {
        if (!mounted) return;
        setAuthorized(false);
        setReady(true);
        setAuthIssue(requestError.message || "Could not verify commissioner access");
      } finally {
        window.clearTimeout(recoveryTimer);
      }
    };

    // This call is intentionally outside onAuthStateChange. Supabase can deadlock
    // when another async client call is made while the auth callback holds its lock.
    supabase.auth.getSession()
      .then(({ data, error: sessionError }) => {
        if (sessionError) throw sessionError;
        if (mounted) return applySession(data.session);
        return undefined;
      })
      .catch((sessionError) => {
        if (!mounted) return;
        window.clearTimeout(recoveryTimer);
        setReady(true);
        setAuthIssue(sessionError.message || "Could not restore the saved sign-in session");
      });

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      // Keep the callback synchronous and defer database work until the auth lock is released.
      afterAuthLock(() => {
        if (mounted) void applySession(next);
      });
    });
    return () => {
      mounted = false;
      window.clearTimeout(recoveryTimer);
      data.subscription.unsubscribe();
    };
  }, [verifyCommissioner]);

  const run = async (action, success) => {
    setError(""); setMessage("");
    try { await action(); setMessage(success); window.setTimeout(() => setMessage(""), 2200); }
    catch (requestError) { setError(requestError.message || "Control update failed"); }
  };

  const selectedMember = bootstrap.members.find((member) => Number(member.rosterId) === Number(teamId));
  const chooseTeam = (value) => { setTeamId(value); const member = bootstrap.members.find((item) => Number(item.rosterId) === Number(value)); setTeamName(control.profiles.find((item) => Number(item.roster_id) === Number(value))?.team_name || member?.teamName || ""); };
  const fireOverlay = () => control.updateState({ announcement:{ ...overlay, duration:Number(overlay.duration), expiresAt:Date.now()+Number(overlay.duration)*1000, nonce:Date.now() } });

  if (!ready) return <main className="loading-screen"><span>Opening secure controls…</span></main>;
  if (!session) return <><Login onReady={verifyCommissioner} />{authIssue && <div className="auth-recovery"><span>{authIssue}</span><button onClick={() => window.location.reload()}>Retry saved session</button></div>}</>;
  if (!authorized) return <main className="commissioner-login"><Shield /><h1>Commissioner access required</h1><p>This signed-in account is not registered as a commissioner.</p><button onClick={() => supabase.auth.signOut()}>Sign out</button></main>;

  return (
    <main className="control-room content-view">
      <header className="control-head"><a href="/"><ArrowLeft />Back to Draft Night</a><div><span>COMMISSIONER CONTROL PLANE</span><h1>Broadcast Command Center</h1></div><button onClick={() => supabase.auth.signOut()}><LogOut size={17} />Sign out</button></header>
      {(message || error) && <div className={error ? "form-error" : "form-success"}>{error || message}</div>}
      <div className="control-grid">
        <PickOperator bootstrap={bootstrap} live={live} enabled={authorized} />
        <article className="control-card panic-card">
          <h2><AlertOctagon /> Draft-night safety</h2>
          <p>Immediately switch every display to a holding screen without touching Sleeper or mock draft state.</p>
          <button className="panic" onClick={() => run(() => control.updateState({ scene: "holding" }), "Holding screen live")}>Panic / hold broadcast</button>
          <button onClick={() => run(() => control.updateState({ scene: "split", camera_layout: "rails", camera_enabled: true }), "Live show restored")}>Restore live show</button>
        </article>
        <article className="control-card">
          <h2>Broadcast scene</h2>
          <div className="button-grid">{[["split","Live show"],["board","Big board"],["cameras","Camera wall"],["ready","Countdown"],["holding","Halftime / Hold"]].map(([value,label]) => <button className={control.state.scene === value ? "active" : ""} key={value} onClick={() => run(() => control.updateState({ scene:value, camera_layout:value==="cameras"?"wall":control.state.camera_layout }), `${label} live`)}>{label}</button>)}</div>
          <h3>Live-show camera placement</h3>
          <div className="button-grid">{[["rails","Side rails"],["filmstrip","Bottom reactions"],["hidden","No cameras"]].map(([value,label]) => <button className={control.state.camera_layout === value ? "active" : ""} key={value} onClick={() => run(() => control.updateState({ camera_layout:value, camera_enabled:value!=="hidden", scene:"split" }), `${label} selected`)}>{label}</button>)}</div>
        </article>
        <article className="control-card clock-control"><h2><Clock3 /> Sleeper draft truth</h2><p>The public clock and on-clock status now follow Sleeper directly. Rehearsals are isolated in the Test Lab and can never replace official picks on public screens.</p><div className="mock-state"><i className={live?.draft?.status === "in_progress" ? "on" : ""}/><b>{String(live?.draft?.status || bootstrap.draft.status).replace("_", " ").toUpperCase()}</b><strong>{Number(live?.draft?.settings?.pickTimer || bootstrap.draft.settings.pickTimer)} SEC</strong></div><div className="button-grid"><a className="control-link-button" href={`https://sleeper.app/draft/nfl/${live?.draft?.draftId || bootstrap.draft.draftId}`} target="sleeper-draft-room" rel="noreferrer"><ExternalLink />Open Sleeper settings</a><a className="control-link-button" href="/test" target="draft-test-lab"><Play />Open safe Test Lab</a></div></article>
        <article className="control-card">
          <h2><Volume2 /> Event audio</h2>
          <p>Viewers can start the live mix once to hear continuous draft-night background music, the opening fanfare, pick chimes, and alert stingers.</p>
        </article>
        <article className="control-card show-control">
          <h2><BellRing /> Show overlays</h2>
          <p>Customize exactly what viewers see, how long it stays up, and which sound cue fires. Pick reveals still happen automatically.</p>
          <div className="overlay-form"><label>Type<select value={overlay.type} onChange={(event)=>setOverlay({...overlay,type:event.target.value})}><option value="announcement">Announcement</option><option value="trade">Trade alert</option><option value="round">Round break</option><option value="celebration">Celebration</option><option value="alert">Urgent alert</option></select></label><label>Kicker<input maxLength="32" value={overlay.kicker} onChange={(event)=>setOverlay({...overlay,kicker:event.target.value})}/></label><label className="wide">Headline<input maxLength="84" value={overlay.title} onChange={(event)=>setOverlay({...overlay,title:event.target.value})}/></label><label className="wide">Details<textarea maxLength="180" value={overlay.detail} onChange={(event)=>setOverlay({...overlay,detail:event.target.value})}/></label><label>Display time<input type="number" min="2" max="30" value={overlay.duration} onChange={(event)=>setOverlay({...overlay,duration:event.target.value})}/></label><label>Sound<select value={overlay.sound} onChange={(event)=>setOverlay({...overlay,sound:event.target.value})}><option value="alert">Alert stinger</option><option value="fanfare">Fanfare</option><option value="none">No sound</option></select></label></div>
          <div className="button-grid"><button onClick={() => { setOverlay({type:"trade",kicker:"TRADE ALERT",title:"A deal is on the board",detail:"Draft positions have changed hands.",duration:8,sound:"alert"}); }}><ArrowLeftRight />Trade preset</button><button onClick={() => { setOverlay({type:"round",kicker:"ROUND COMPLETE",title:"Round complete",detail:"Reset, reload, and get ready for the next run.",duration:9,sound:"fanfare"}); }}><Trophy />Round preset</button><button className="active" onClick={() => run(fireOverlay,"Custom overlay live")}><Play />Take live</button><button onClick={() => run(() => control.updateState({announcement:null}),"Overlay cleared")}><X />Clear</button></div>
        </article>
        <article className="control-card ticker-control"><h2>Live tickers</h2><p>Add headlines, jokes, updates, or stats. Sleeper picks are added to the lower Draft Feed automatically.</p><div className="overlay-form"><label>Lane<select value={ticker.lane} onChange={(event)=>setTicker({...ticker,lane:event.target.value})}><option value="top">Top news</option><option value="bottom">Bottom feed</option></select></label><label>Type<select value={ticker.kind} onChange={(event)=>setTicker({...ticker,kind:event.target.value})}><option value="news">News</option><option value="status">Status</option><option value="alert">Alert</option><option value="stat">Stat</option></select></label><label className="wide">Text<input maxLength="280" value={ticker.text} onChange={(event)=>setTicker({...ticker,text:event.target.value})}/></label><label>Accent<input type="color" value={ticker.accent} onChange={(event)=>setTicker({...ticker,accent:event.target.value})}/></label></div><button disabled={!ticker.text.trim()} onClick={() => run(async()=>{const result=await supabase.from("ticker_items").insert({...ticker,text:ticker.text.trim(),league_id:LEAGUE_ID,active:true}).select();if(result.error)throw result.error;setTicker({...ticker,text:""});await control.reload();},"Ticker item added")}><Plus/>Add ticker item</button><div className="ticker-admin-list">{control.tickers.map((item)=><div key={item.id}><i style={{background:item.accent}}/><span><b>{item.lane} · {item.kind}</b>{item.text}</span><button onClick={()=>run(async()=>{const result=await supabase.from("ticker_items").delete().eq("id",item.id);if(result.error)throw result.error;await control.reload();},"Ticker removed")}><Trash2/></button></div>)}</div></article>
        <article className="control-card team-password-card">
          <h2>Team access & identity</h2>
          <p>Team numbers mirror Sleeper roster slots and cannot drift. Existing passwords cannot be displayed because only secure hashes are stored, but you can reset or remove them.</p>
          <label>Team<select value={teamId} onChange={(event) => chooseTeam(event.target.value)}>{bootstrap.members.map((member) => <option value={member.rosterId} key={member.rosterId}>Team {member.rosterId} · {member.teamName}</option>)}</select></label>
          <label>Display name<input maxLength="36" value={teamName} onChange={(event)=>setTeamName(event.target.value)}/></label><div className="team-access-meta"><span>TEAM NUMBER <b>{selectedMember?.rosterId}</b></span><span>SLEEPER OWNER <b>{selectedMember?.displayName}</b></span></div><button onClick={() => run(async()=>{const result=await supabase.from("team_profiles").update({team_name:teamName,updated_at:new Date().toISOString()}).eq("league_id",LEAGUE_ID).eq("roster_id",Number(teamId));if(result.error)throw result.error;await control.reload();},"Team name updated")}><Save/>Save team name</button>
          <label>New password<input type="password" minLength="6" maxLength="72" value={teamPassword} onChange={(event) => setTeamPassword(event.target.value)} /></label>
          <button disabled={teamPassword.length < 6} onClick={() => run(async () => { const result = await supabase.rpc("set_team_password", { p_league_id: LEAGUE_ID, p_roster_id: Number(teamId), p_password: teamPassword }); if (result.error) throw result.error; setTeamPassword(""); }, "Team password saved")}><Save />Save team password</button>
          <button className="danger-lite" onClick={() => run(async()=>{const result=await supabase.rpc("clear_team_password",{p_league_id:LEAGUE_ID,p_roster_id:Number(teamId)});if(result.error)throw result.error;},"Team password removed")}><Trash2/>Remove team password</button>
        </article>
      </div>
    </main>
  );
}
