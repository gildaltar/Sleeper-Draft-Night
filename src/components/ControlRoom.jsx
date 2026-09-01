import { AlertOctagon, ArrowLeft, ArrowLeftRight, BellRing, Camera, Clock3, ExternalLink, LayoutDashboard, LogOut, Play, Plus, Radio, Save, Shield, Trash2, Trophy, Users, Volume2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { LEAGUE_ID } from "../lib/config";
import { afterAuthLock, checkCommissioner } from "../lib/controlAuth";
import { supabase } from "../lib/supabase";
import { teamAccess } from "../lib/teamAccess";
import DraftAudio from "./DraftAudio";
import PickOperator from "./PickOperator";

function Login({onReady}) {
  const [email,setEmail] = useState("");const [password,setPassword] = useState("");const [message,setMessage] = useState("");const [busy,setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);setMessage("");
    try {
      const result = await supabase.auth.signInWithPassword({email,password});
      if (result.error) throw result.error;
      await onReady(result.data.session);
    } catch (error) {setMessage(error.message || "Could not open the control room");}
    finally {setBusy(false);}
  };
  return <main className="commissioner-login"><Shield /><span>SECURE CONTROL ROOM</span><h1>Commissioner sign-in</h1><p>Broadcast viewers and team owners never see these controls.</p><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submit()} /></label><button disabled={busy || !email || password.length < 6} onClick={submit}>{busy ? "Signing in…" : "Enter control room"}</button>{message && <div className="form-error">{message}</div>}</main>;
}

export default function ControlRoom({control,bootstrap,live}) {
  const [session,setSession] = useState(null);const [authorized,setAuthorized] = useState(false);const [ready,setReady] = useState(false);
  const [message,setMessage] = useState("");const [error,setError] = useState("");const [authIssue,setAuthIssue] = useState("");
  const [activeTab,setActiveTab] = useState("show");const [memberships,setMemberships] = useState([]);
  const [teamId,setTeamId] = useState("1");const [teamPassword,setTeamPassword] = useState("");const [teamName,setTeamName] = useState(bootstrap.members[0]?.teamName || "");
  const [overlay,setOverlay] = useState({type:"announcement",kicker:"COMMISSIONER UPDATE",title:"Draft room announcement",detail:"Stand by for an update from the commissioner.",duration:7,sound:"announcement"});
  const [ticker,setTicker] = useState({lane:"bottom",kind:"news",text:"",accent:"#b8ff38"});
  const [services,setServices] = useState({video:"CHECKING",music:"CHECKING"});

  const loadMemberships = useCallback(async () => {
    const result = await supabase.from("team_owner_memberships").select("league_id,roster_id,user_id,owner_email,claimed_at").eq("league_id",LEAGUE_ID).order("roster_id");
    if (!result.error) setMemberships(result.data || []);
  },[]);
  const verifyCommissioner = useCallback(async (active) => {
    if (!active) {setSession(null);setAuthorized(false);setReady(true);return;}
    const isAuthorized = await checkCommissioner(supabase,active);
    setSession(active);setAuthorized(isAuthorized);setReady(true);setAuthIssue("");
    if (isAuthorized) await loadMemberships();
  },[loadMemberships]);

  useEffect(() => {
    let mounted = true;
    const timer = window.setTimeout(() => {if (mounted) {setReady(true);setAuthIssue("The saved sign-in session took too long to open. You can retry without clearing site data.");}},7000);
    const apply = async (next) => {
      try {await verifyCommissioner(next);}
      catch (requestError) {if (mounted) {setAuthorized(false);setReady(true);setAuthIssue(requestError.message || "Could not verify commissioner access");}}
      finally {window.clearTimeout(timer);}
    };
    supabase.auth.getSession().then(({data,error:sessionError}) => {if (sessionError) throw sessionError;if (mounted) return apply(data.session);return undefined;}).catch((sessionError) => {if (mounted) {window.clearTimeout(timer);setReady(true);setAuthIssue(sessionError.message || "Could not restore the saved session");}});
    const {data} = supabase.auth.onAuthStateChange((_event,next) => afterAuthLock(() => {if (mounted) void apply(next);}));
    return () => {mounted = false;window.clearTimeout(timer);data.subscription.unsubscribe();};
  },[verifyCommissioner]);

  useEffect(() => {
    if (!authorized) return;
    let active = true;
    Promise.allSettled([
      fetch("/api/livekit-token",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({role:"viewer",leagueId:LEAGUE_ID})}).then((response) => response.json().then((data) => ({ok:response.ok,data}))),
      fetch("/api/apple-music-token").then((response) => response.json().then((data) => ({ok:response.ok,data}))),
    ]).then(([video,music]) => {
      if (!active) return;
      setServices({
        video:video.status === "fulfilled" && video.value.ok && video.value.data.configured ? "READY" : "SETUP NEEDED",
        music:music.status === "fulfilled" && music.value.ok && music.value.data.configured ? "READY" : "SETUP NEEDED",
      });
    });
    return () => {active = false;};
  },[authorized]);

  const run = async (action,success) => {
    setError("");setMessage("");
    try {await action();setMessage(success);window.setTimeout(() => setMessage(""),2600);}
    catch (requestError) {setError(requestError.message || "Control update failed");}
  };
  const selectedMember = bootstrap.members.find((member) => Number(member.rosterId) === Number(teamId));
  const selectedMembership = memberships.find((item) => Number(item.roster_id) === Number(teamId));
  const chooseTeam = (value) => {
    setTeamId(value);
    const member = bootstrap.members.find((item) => Number(item.rosterId) === Number(value));
    setTeamName(control.profiles.find((item) => Number(item.roster_id) === Number(value))?.team_name || member?.teamName || "");
  };
  const fireOverlay = () => control.updateState({announcement:{...overlay,duration:Number(overlay.duration),expiresAt:Date.now() + Number(overlay.duration) * 1000,nonce:Date.now()}});
  const status = String(live?.draft?.status || bootstrap.draft.status).replace("_"," ").toUpperCase();
  const pickTimer = Number(live?.draft?.settings?.pickTimer || bootstrap.draft.settings.pickTimer);

  if (!ready) return <main className="loading-screen"><span>Opening secure controls…</span></main>;
  if (!session) return <><Login onReady={verifyCommissioner} />{authIssue && <div className="auth-recovery"><span>{authIssue}</span><button onClick={() => window.location.reload()}>Retry saved session</button></div>}</>;
  if (!authorized) return <main className="commissioner-login"><Shield /><h1>Commissioner access required</h1><p>This signed-in account is not registered as a commissioner.</p><button onClick={() => supabase.auth.signOut()}>Sign out</button></main>;

  return (
    <main className="control-room content-view control-console">
      <header className="control-head control-console-head"><a href="/"><ArrowLeft />Draft Night</a><div><span>COMMISSIONER CONTROL PLANE</span><h1>Control Room</h1></div><button onClick={() => supabase.auth.signOut()}><LogOut />Sign out</button></header>
      <section className="control-health-strip">
        <span><i className={status === "IN PROGRESS" ? "on" : ""}/><small>SLEEPER</small><b>{status}</b></span>
        <span><Clock3 /><small>PICK TIMER</small><b>{Math.floor(pickTimer / 60)}:{String(pickTimer % 60).padStart(2,"0")}</b></span>
        <span><Camera /><small>CAMERA RELAY</small><b>LIVEKIT {services.video}</b></span>
        <span><Volume2 /><small>APPLE MUSIC</small><b>{services.music}</b></span>
        <span><Users /><small>OWNERS CLAIMED</small><b>{memberships.length} / {bootstrap.members.length}</b></span>
        <span><Radio /><small>PUBLIC MODE</small><b>{control.state.mock_mode ? "MOCK WARNING" : "SLEEPER LIVE"}</b></span>
      </section>
      <nav className="control-tabs" aria-label="Control Room sections">
        {[["show",LayoutDashboard,"Show"],["draft",Clock3,"Draft Ops"],["audio",Volume2,"Audio"],["overlays",BellRing,"Overlays"],["teams",Users,"Teams"]].map(([value,Icon,label]) => <button className={activeTab === value ? "active" : ""} onClick={() => setActiveTab(value)} key={value}><Icon />{label}</button>)}
      </nav>
      {(message || error) && <div className={error ? "form-error control-toast" : "form-success control-toast"}>{error || message}</div>}
      <section className="control-emergency-bar"><div><AlertOctagon /><span><b>Emergency program controls</b><small>These change the public display without touching official Sleeper state.</small></span></div><button className="panic" onClick={() => run(() => control.updateState({scene:"holding"}),"Holding screen live")}>Hold broadcast</button><button onClick={() => run(() => control.updateState({scene:"split",camera_layout:"rails",camera_enabled:true}),"Live show restored")}>Restore live show</button></section>

      <div className="control-grid control-tab-panel">
        {activeTab === "show" && <>
          <article className="control-card control-card-wide"><h2><LayoutDashboard />Scene switcher</h2><p>One deliberate action changes the public program. The selected scene is always highlighted.</p><div className="scene-switcher">{[["split","Live show"],["board","Big board"],["cameras","Camera wall"],["ready","Countdown"],["holding","Hold screen"]].map(([value,label],index) => <button className={control.state.scene === value ? "active" : ""} key={value} onClick={() => run(() => control.updateState({scene:value,camera_layout:value === "cameras" ? "wall" : control.state.camera_layout}),`${label} live`)}><strong>{index + 1}</strong>{label}</button>)}</div></article>
          <article className="control-card"><h2><Camera />Camera layout</h2><p>Choose how owner feeds appear in the live-show scene.</p><div className="button-grid">{[["rails","Side rails"],["filmstrip","Bottom reactions"],["wall","Full wall"],["hidden","No cameras"]].map(([value,label]) => <button className={control.state.camera_layout === value ? "active" : ""} key={value} onClick={() => run(() => control.updateState({camera_layout:value,camera_enabled:value !== "hidden",scene:value === "wall" ? "cameras" : "split"}),`${label} selected`)}>{label}</button>)}</div></article>
          <article className="control-card"><h2><Radio />Show truth</h2><div className="mock-state"><i className={status === "IN PROGRESS" ? "on" : ""}/><b>{status}</b><strong>{pickTimer} SEC</strong></div><p>Public screens use official Sleeper status and picks. Rehearsal state remains isolated in Test Lab.</p><div className="button-grid"><a className="control-link-button" href={`https://sleeper.app/draft/nfl/${live?.draft?.draftId || bootstrap.draft.draftId}`} target="sleeper-draft-room" rel="noreferrer"><ExternalLink />Sleeper</a><a className="control-link-button" href="/test" target="draft-test-lab"><Play />Test Lab</a></div></article>
        </>}

        {activeTab === "draft" && <><PickOperator bootstrap={bootstrap} live={live} enabled={authorized} /><article className="control-card control-card-wide"><h2><Clock3 />Official draft state</h2><div className="operator-truth-strip"><span>STATUS<b>{status}</b></span><span>PICKS<b>{live?.picks?.length || 0}</b></span><span>TIMER<b>{pickTimer}s</b></span><span>MOCK MODE<b>{control.state.mock_mode ? "ON" : "OFF"}</b></span><a href={`https://sleeper.app/draft/nfl/${live?.draft?.draftId || bootstrap.draft.draftId}`} target="sleeper-draft-room" rel="noreferrer"><ExternalLink />Open Sleeper operator room</a></div></article></>}

        {activeTab === "audio" && <article className="control-card control-card-wide control-audio-card"><h2><Volume2 />Sound mix & Apple Music</h2><p>Start audio once on the production device. Each cue has its own level; music ducks automatically for show sounds and then resumes.</p><DraftAudio picks={live?.picks || []} draftStatus={live?.draft?.status || bootstrap.draft.status} announcement={control.state.announcement} panel /></article>}

        {activeTab === "overlays" && <>
          <article className="control-card control-card-wide show-control"><h2><BellRing />Show overlays</h2><p>Build the exact message viewers see and select its sound.</p><div className="overlay-form"><label>Type<select value={overlay.type} onChange={(event) => setOverlay({...overlay,type:event.target.value})}><option value="announcement">Announcement</option><option value="trade">Trade alert</option><option value="round">Round break</option><option value="celebration">Celebration</option><option value="alert">Urgent alert</option></select></label><label>Kicker<input maxLength="32" value={overlay.kicker} onChange={(event) => setOverlay({...overlay,kicker:event.target.value})}/></label><label className="wide">Headline<input maxLength="84" value={overlay.title} onChange={(event) => setOverlay({...overlay,title:event.target.value})}/></label><label className="wide">Details<textarea maxLength="180" value={overlay.detail} onChange={(event) => setOverlay({...overlay,detail:event.target.value})}/></label><label>Display time<input type="number" min="2" max="30" value={overlay.duration} onChange={(event) => setOverlay({...overlay,duration:event.target.value})}/></label><label>Sound<select value={overlay.sound} onChange={(event) => setOverlay({...overlay,sound:event.target.value})}><option value="announcement">Announcement</option><option value="alert">Alert</option><option value="fanfare">Fanfare</option><option value="none">None</option></select></label></div><div className="button-grid"><button onClick={() => setOverlay({type:"trade",kicker:"TRADE ALERT",title:"A deal is on the board",detail:"Draft positions have changed hands.",duration:8,sound:"alert"})}><ArrowLeftRight />Trade preset</button><button onClick={() => setOverlay({type:"round",kicker:"ROUND COMPLETE",title:"Round complete",detail:"Reset, reload, and get ready for the next run.",duration:9,sound:"fanfare"})}><Trophy />Round preset</button><button className="active" onClick={() => run(fireOverlay,"Overlay live")}><Play />Take live</button><button onClick={() => run(() => control.updateState({announcement:null}),"Overlay cleared")}><X />Clear</button></div></article>
          <article className="control-card control-card-wide ticker-control"><h2>Live tickers</h2><div className="overlay-form"><label>Lane<select value={ticker.lane} onChange={(event) => setTicker({...ticker,lane:event.target.value})}><option value="top">Top news</option><option value="bottom">Bottom feed</option></select></label><label>Type<select value={ticker.kind} onChange={(event) => setTicker({...ticker,kind:event.target.value})}><option value="news">News</option><option value="status">Status</option><option value="alert">Alert</option><option value="stat">Stat</option></select></label><label className="wide">Text<input maxLength="280" value={ticker.text} onChange={(event) => setTicker({...ticker,text:event.target.value})}/></label><label>Accent<input type="color" value={ticker.accent} onChange={(event) => setTicker({...ticker,accent:event.target.value})}/></label></div><button disabled={!ticker.text.trim()} onClick={() => run(async () => {const result = await supabase.from("ticker_items").insert({...ticker,text:ticker.text.trim(),league_id:LEAGUE_ID,active:true}).select();if (result.error) throw result.error;setTicker({...ticker,text:""});await control.reload();},"Ticker added")}><Plus />Add ticker</button><div className="ticker-admin-list">{control.tickers.map((item) => <div key={item.id}><i style={{background:item.accent}}/><span><b>{item.lane} · {item.kind}</b>{item.text}</span><button onClick={() => run(async () => {const result = await supabase.from("ticker_items").delete().eq("id",item.id);if (result.error) throw result.error;await control.reload();},"Ticker removed")}><Trash2 /></button></div>)}</div></article>
        </>}

        {activeTab === "teams" && <>
          <article className="control-card team-claim-overview control-card-wide"><h2><Users />Owner authentication</h2><p>Each owner signs in by email and claims exactly one team with the commissioner-issued code.</p><div className="team-claim-grid">{bootstrap.members.map((member) => {const claim = memberships.find((item) => Number(item.roster_id) === Number(member.rosterId));return <button className={Number(teamId) === Number(member.rosterId) ? "selected" : ""} onClick={() => chooseTeam(String(member.rosterId))} key={member.rosterId}><strong>{member.rosterId}</strong><span><b>{member.teamName}</b><small>{claim ? claim.owner_email : "Not claimed"}</small></span><i className={claim ? "claimed" : ""}/></button>;})}</div></article>
          <article className="control-card team-password-card control-card-wide"><h2>Selected team</h2><div className="team-access-meta"><span>TEAM NUMBER<b>{selectedMember?.rosterId}</b></span><span>SLEEPER OWNER<b>{selectedMember?.displayName}</b></span><span>AUTH OWNER<b>{selectedMembership?.owner_email || "Not claimed"}</b></span></div><label>Display name<input maxLength="36" value={teamName} onChange={(event) => setTeamName(event.target.value)}/></label><button onClick={() => run(async () => {const result = await supabase.from("team_profiles").update({team_name:teamName,updated_at:new Date().toISOString()}).eq("league_id",LEAGUE_ID).eq("roster_id",Number(teamId));if (result.error) throw result.error;await control.reload();},"Team name updated")}><Save />Save team name</button><label>New one-time claim code<input type="password" minLength="6" maxLength="72" value={teamPassword} onChange={(event) => setTeamPassword(event.target.value)} /></label><button disabled={teamPassword.length < 6} onClick={() => run(async () => {await teamAccess("set-claim-code",Number(teamId),{password:teamPassword});setTeamPassword("");},"Claim code saved")}><Save />Save claim code</button>{selectedMembership && <button className="danger-lite" onClick={() => run(async () => {await teamAccess("revoke-owner",Number(teamId));await loadMemberships();},"Owner access revoked")}><Trash2 />Revoke owner claim</button>}</article>
        </>}
      </div>
    </main>
  );
}
