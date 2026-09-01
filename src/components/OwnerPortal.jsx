import { Camera, Check, Eye, EyeOff, ImagePlus, ListPlus, Lock, LogOut, Mic, MicOff, Palette, Save, Send, Signal, Sparkles, StopCircle, VideoOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { startOwnerCamera } from "../hooks/useLiveKit";
import { TEAM_ACCENTS } from "../lib/config";
import { memberForPick, parsePanelProfile, rosterNeeds } from "../lib/draft";
import { stadium } from "../lib/showAssets";
import { supabase } from "../lib/supabase";
import { teamAccess } from "../lib/teamAccess";
import DraftDesk from "./DraftDesk";
import HelmetIdentity from "./HelmetIdentity";

const TEAM_CHOICES = [
  ["custom","Custom identity"],["atl","Atlanta"],["buf","Buffalo"],["car","Carolina"],["chi","Chicago"],["cin","Cincinnati"],["cle","Cleveland"],["dal","Dallas"],["den","Denver"],["det","Detroit"],["gb","Green Bay"],["hou","Houston"],["ind","Indianapolis"],["jax","Jacksonville"],["kc","Kansas City"],["lv","Las Vegas"],["lac","Los Angeles Chargers"],["lar","Los Angeles Rams"],["mia","Miami"],["min","Minnesota"],["ne","New England"],["no","New Orleans"],["nyg","New York Giants"],["nyj","New York Jets"],["phi","Philadelphia"],["pit","Pittsburgh"],["sea","Seattle"],["sf","San Francisco"],["tb","Tampa Bay"],["ten","Tennessee"],["wsh","Washington"],
];
const FRAME_STYLES = [["broadcast","Clean"],["neon","Neon"],["championship","Championship"],["rivalry","Rivalry"],["carbon","Carbon"],["grid","Grid"]];

function formFrom(profile,member,rosterId) {
  const panel = parsePanelProfile(profile?.panel_style);
  return {
    teamName:profile?.team_name || member?.teamName || "",
    motto:profile?.motto || "",badge:profile?.badge || "",
    accent:profile?.accent || TEAM_ACCENTS[rosterId - 1]?.[0] || "#1f9bfe",
    accent2:profile?.accent_2 || TEAM_ACCENTS[rosterId - 1]?.[1] || "#b7ff3c",
    panelStyle:panel.style,intensity:panel.intensity,favorite:panel.favorite,nameplate:panel.nameplate,
    logo:panel.logo,borderWidth:panel.borderWidth,backgroundMode:panel.backgroundMode,background:panel.background,
  };
}

export default function OwnerPortal({data,control,rosterId,testMode = false}) {
  const member = data.bootstrap.members.find((item) => Number(item.rosterId) === Number(rosterId));
  const profile = control.profiles.find((item) => Number(item.roster_id) === Number(rosterId));
  const draftKey = `sdn-studio-draft-v5-${rosterId}`;
  const [session,setSession] = useState(null);
  const [authReady,setAuthReady] = useState(testMode);
  const [unlocked,setUnlocked] = useState(testMode);
  const [email,setEmail] = useState("");
  const [claimCode,setClaimCode] = useState("");
  const [showPassword,setShowPassword] = useState(false);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [activeTab,setActiveTab] = useState("camera");
  const [previewState,setPreviewState] = useState("normal");
  const [dirty,setDirty] = useState(false);
  const [form,setForm] = useState(() => formFrom(profile,member,rosterId));
  const [cameraState,setCameraState] = useState("idle");
  const [cameraEnabled,setCameraEnabled] = useState(true);
  const [microphoneEnabled,setMicrophoneEnabled] = useState(true);
  const cameraMount = useRef(null);
  const cameraSession = useRef(null);
  const lastAutoOpened = useRef(0);

  useEffect(() => {
    if (testMode) return undefined;
    let mounted = true;
    supabase.auth.getSession().then(({data:result}) => {
      if (!mounted) return;
      setSession(result.session);
      setAuthReady(true);
    });
    const {data:listener} = supabase.auth.onAuthStateChange((_event,next) => {
      window.setTimeout(() => {
        if (!mounted) return;
        setSession(next);
        setAuthReady(true);
      },0);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  },[testMode]);

  useEffect(() => {
    if (testMode || !authReady || !session) return;
    let active = true;
    setBusy(true);
    teamAccess("session",rosterId)
      .then(() => { if (active) {setUnlocked(true);setMessage("");} })
      .catch((error) => { if (active) {setUnlocked(false);setMessage(error.message || "This account has not claimed this team.");} })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  },[authReady,rosterId,session?.user?.id,testMode]);

  useEffect(() => {
    const serverForm = formFrom(profile,member,rosterId);
    let stored = null;
    try { stored = JSON.parse(window.localStorage.getItem(draftKey) || "null"); }
    catch { /* Ignore unavailable or invalid local storage. */ }
    if (stored?.form) {
      setForm({...serverForm,...stored.form});
      setDirty(true);
    } else {
      setForm(serverForm);
      setDirty(false);
    }
  },[draftKey,member?.teamName,profile?.updated_at,rosterId]);

  useEffect(() => () => { void cameraSession.current?.destroy?.(); },[]);

  const update = (key,value) => {
    setForm((current) => {
      const next = {...current,[key]:value};
      try { window.localStorage.setItem(draftKey,JSON.stringify({savedAt:Date.now(),form:next})); }
      catch { /* Storage can be unavailable in private browsing. */ }
      return next;
    });
    setDirty(true);
    setMessage("");
  };

  const sendMagicLink = async () => {
    setBusy(true);setMessage("");
    try {
      const redirect = new URL("/team",window.location.origin);
      redirect.searchParams.set("team",String(rosterId));
      const {error} = await supabase.auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:redirect.toString(),shouldCreateUser:true}});
      if (error) throw error;
      setMessage("Check your email and open the secure sign-in link on this device.");
    } catch (error) { setMessage(error.message || "Could not send the sign-in link"); }
    finally { setBusy(false); }
  };

  const claim = async () => {
    setBusy(true);setMessage("");
    try {
      await teamAccess("claim",rosterId,{password:claimCode});
      setUnlocked(true);setClaimCode("");
      setMessage("Team ownership verified. This device is signed in.");
    } catch (error) { setMessage(error.message || "Could not claim this team"); }
    finally { setBusy(false); }
  };

  const save = async () => {
    setBusy(true);setMessage("");
    try {
      const panelStyle = [form.panelStyle,form.intensity,form.favorite,form.nameplate,encodeURIComponent(form.logo || ""),form.borderWidth,form.backgroundMode,encodeURIComponent(form.background || "")].join("|");
      if (testMode) control.updateProfile(rosterId,{team_name:form.teamName,motto:form.motto,badge:form.badge,accent:form.accent,accent_2:form.accent2,panel_style:panelStyle});
      else {
        await teamAccess("update",rosterId,{...form,panelStyle});
        await control.reload();
      }
      try { window.localStorage.removeItem(draftKey); } catch { /* Ignore storage errors. */ }
      setDirty(false);
      setMessage(testMode ? "Saved in this Test Lab tab" : "Saved live across every draft screen");
    } catch (error) { setMessage(error.message || "Could not save team profile"); }
    finally { setBusy(false); }
  };

  const startCamera = async () => {
    if (testMode) {setCameraState("joined");setMessage("Simulated camera is live in Test Lab.");return;}
    try {
      cameraSession.current = await startOwnerCamera({rosterId,mount:cameraMount.current,onStatus:(state,detail) => {setCameraState(state);setMessage(detail);}});
    } catch (error) {setCameraState("error");setMessage(error.message || "Could not start camera");}
  };
  const stopCamera = async () => {
    await cameraSession.current?.destroy?.();
    cameraSession.current = null;
    cameraMount.current?.replaceChildren();
    setCameraState("idle");setCameraEnabled(true);setMicrophoneEnabled(true);setMessage("Camera stopped.");
  };
  const toggleCamera = () => {
    const next = !cameraEnabled;
    cameraSession.current?.setCamera(next);
    setCameraEnabled(next);
  };
  const toggleMicrophone = () => {
    const next = !microphoneEnabled;
    cameraSession.current?.setMicrophone(next);
    setMicrophoneEnabled(next);
  };

  const activePicks = testMode ? control.state.mock_picks || [] : data.live?.picks || [];
  const activeDraft = data.live?.draft || data.bootstrap.draft;
  const needs = useMemo(() => rosterNeeds(data.bootstrap.league,activePicks,rosterId),[activePicks,data.bootstrap.league,rosterId]);
  const isOnClock = (testMode || activeDraft.status === "in_progress") && Number(memberForPick(activePicks.length + 1,activeDraft,data.bootstrap.members)?.rosterId) === Number(rosterId);
  useEffect(() => {
    const pickNo = activePicks.length + 1;
    if (unlocked && isOnClock && lastAutoOpened.current !== pickNo) {lastAutoOpened.current = pickNo;setActiveTab("draft");}
  },[activePicks.length,isOnClock,unlocked]);

  const loadImage = (event,type) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const image = new Image();
    image.onload = () => {
      const isLogo = type === "logo";
      const canvas = document.createElement("canvas");
      canvas.width = isLogo ? 96 : 640; canvas.height = isLogo ? 96 : 360;
      const context = canvas.getContext("2d");
      const scale = (isLogo ? Math.min : Math.max)(canvas.width / image.width,canvas.height / image.height);
      const width = image.width * scale; const height = image.height * scale;
      context.drawImage(image,(canvas.width - width) / 2,(canvas.height - height) / 2,width,height);
      update(type,canvas.toDataURL("image/webp",isLogo ? .72 : .62));
      if (!isLogo) update("backgroundMode","custom");
      URL.revokeObjectURL(image.src);
    };
    image.src = URL.createObjectURL(file);
  };

  if (!member) return <main className="loading-screen"><span>Team not found</span></main>;
  if (!authReady) return <main className="loading-screen"><span>Checking secure team access…</span></main>;

  if (!testMode && !session) return (
    <main className="team-gate team-auth-gate" style={{"--team":form.accent}}>
      <a href="/">← Back to draft</a><Lock /><span>TEAM OWNER SIGN-IN</span><h1>{member.teamName}</h1>
      <p>Use the actual owner's email. A one-time sign-in link protects the Studio and Draft Desk on future visits.</p>
      <label>Owner email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} onKeyDown={(event) => event.key === "Enter" && sendMagicLink()} placeholder="owner@example.com" /></label>
      <button disabled={busy || !email.includes("@")} onClick={sendMagicLink}><Send />{busy ? "Sending…" : "Email secure sign-in link"}</button>
      {message && <div className={message.startsWith("Check") ? "form-success" : "form-error"}>{message}</div>}
    </main>
  );

  if (!unlocked) return (
    <main className="team-gate team-auth-gate" style={{"--team":form.accent}}>
      <a href="/">← Back to draft</a><Lock /><span>CLAIM TEAM {rosterId}</span><h1>{member.teamName}</h1>
      <p>Signed in as <b>{session?.user?.email}</b>. Enter the one-time claim code supplied by the commissioner. After this, the code is no longer used for access.</p>
      <label>Team claim code<div><input type={showPassword ? "text" : "password"} value={claimCode} onChange={(event) => setClaimCode(event.target.value)} onKeyDown={(event) => event.key === "Enter" && claim()} /><button aria-label={showPassword ? "Hide code" : "Show code"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff /> : <Eye />}</button></div></label>
      <button disabled={busy || claimCode.length < 6} onClick={claim}><Lock />{busy ? "Verifying…" : "Claim this team"}</button>
      <button className="gate-signout" onClick={() => supabase.auth.signOut()}><LogOut />Use a different email</button>
      {message && <div className="form-error">{message}</div>}
    </main>
  );

  const cameraReady = ["preview","joined"].includes(cameraState);
  const relayLive = cameraState === "joined";
  const logo = form.logo || (form.favorite !== "custom" ? `https://a.espncdn.com/i/teamlogos/nfl/500/${form.favorite}.png` : "");
  const backgroundImage = form.backgroundMode === "custom" && form.background ? `url(${form.background})` : form.backgroundMode === "stadium" ? `url(${stadium})` : undefined;
  return (
    <main className="owner-portal team-studio studio-v2" style={{"--team":form.accent,"--team-2":form.accent2,"--intensity":Number(form.intensity) / 100,"--frame-pct":`${form.intensity}%`,"--frame-glow":`${Number(form.intensity) * .34}px`,"--border-width":`${form.borderWidth}px`}}>
      <header className="studio-app-header">
        <div><span>TEAM STUDIO · TEAM {rosterId}{testMode ? " · SAFE PREVIEW" : ""}</span><h1>{form.teamName}</h1><p>{member.displayName} · {session?.user?.email || "Test owner"}</p></div>
        <div className="studio-header-actions"><b className={dirty ? "unsaved" : "saved"}>{dirty ? "UNSAVED" : <><Check /> SAVED</>}</b>{testMode ? <a className="studio-back" href="/test">Back to Test Lab</a> : <button onClick={() => supabase.auth.signOut()}><LogOut />Sign out</button>}</div>
      </header>
      <nav className="studio-tabs" aria-label="Team Studio sections">
        {[["camera",Camera,"Camera"],["look",Palette,"Look"],["draft",ListPlus,"Draft Desk"]].map(([value,Icon,label]) => <button className={activeTab === value ? "active" : ""} onClick={() => setActiveTab(value)} key={value}><Icon />{label}{value === "draft" && isOnClock ? <i /> : null}</button>)}
      </nav>

      {activeTab === "draft" ? <section className="studio-draft-panel"><DraftDesk data={data} control={control} rosterId={rosterId} /></section> : (
        <div className="owner-layout studio-workspace">
          <section className="camera-workspace studio-preview-column">
            <div className="studio-preview-head"><div><span>LIVE PREVIEW</span><b>{previewState.replace("-"," ")}</b></div><div>{[["normal","Normal"],["on-clock","On clock"],["celebration","Celebration"]].map(([value,label]) => <button className={previewState === value ? "active" : ""} key={value} onClick={() => setPreviewState(value)}>{label}</button>)}</div></div>
            <div className={`owner-camera studio-frame style-${form.panelStyle} preview-${previewState}`} style={{backgroundImage}}>
              <div className="owner-camera-video" ref={cameraMount}>{!cameraReady && <div className="camera-placeholder"><Camera /><b>Camera not started</b><small>Native browser camera · 16:9</small></div>}</div>
              <div className={`studio-nameplate nameplate-${form.nameplate}`}><HelmetIdentity profile={{...profile,team_name:form.teamName,panel_style:[form.panelStyle,form.intensity,form.favorite,form.nameplate,encodeURIComponent(form.logo || "")].join("|")}} member={member} compact /><div><strong>{form.teamName}</strong><small>{form.motto || "Make draft night yours"}</small></div><b>{form.badge || "LIVE"}</b></div>
              {previewState === "on-clock" && <em className="studio-state">ON THE CLOCK · 0:45</em>}
              {previewState === "celebration" && <div className="celebration-burst"><Sparkles />PICK CELEBRATION</div>}
            </div>
            <div className={`studio-health state-${cameraState}`}>
              <span><Camera /><b>DEVICE</b>{cameraReady ? "Ready" : cameraState === "connecting" ? "Starting" : "Off"}</span>
              <span><Signal /><b>RELAY</b>{relayLive ? "On air" : cameraReady ? "Setup needed" : "Offline"}</span>
              <span><Save /><b>LOOK</b>{dirty ? "Unsaved" : "Saved"}</span>
            </div>
            <div className="owner-needs"><div><small>ROSTER NEEDS</small>{needs.slice(0,7).map(([position,count]) => <span key={position}><b>{count}</b>{position}</span>)}</div><div><small>{isOnClock ? "YOU'RE UP" : "DRAFT PLAN"}</small><strong>{isOnClock ? "Pick now" : `${activePicks.length + 1} live`}</strong><button className="open-draft-desk" onClick={() => setActiveTab("draft")}><ListPlus />Open Draft Desk</button></div></div>
          </section>

          <aside className="container-editor studio-editor studio-controls">
            {activeTab === "camera" ? <>
              <div className="studio-section-head"><span>CAMERA & MICROPHONE</span><b>Browser native capture</b></div>
              <div className="native-camera-actions">
                <button className="primary" disabled={cameraState === "connecting" || cameraReady} onClick={startCamera}><Camera />{cameraState === "connecting" ? "Starting…" : "Start camera & mic"}</button>
                <button className={cameraEnabled ? "active" : ""} disabled={!cameraReady} onClick={toggleCamera}>{cameraEnabled ? <Camera /> : <VideoOff />}{cameraEnabled ? "Camera on" : "Camera off"}</button>
                <button className={microphoneEnabled ? "active" : ""} disabled={!cameraReady} onClick={toggleMicrophone}>{microphoneEnabled ? <Mic /> : <MicOff />}{microphoneEnabled ? "Mic on" : "Mic muted"}</button>
                <button className="danger-lite" disabled={!cameraReady} onClick={stopCamera}><StopCircle />Stop</button>
              </div>
              <div className={`camera-inline-status ${cameraState === "error" ? "error" : ""}`}><i />{message || "Camera permission is requested only when you press Start."}</div>
              <fieldset><legend>Camera background</legend><div className="style-options nameplate-options">{[["studio","Studio"],["stadium","Stadium"],["custom","Custom"]].map(([value,label]) => <button type="button" className={form.backgroundMode === value ? "active" : ""} key={value} onClick={() => update("backgroundMode",value)}>{label}</button>)}</div><label className="logo-upload"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => loadImage(event,"background")} /><b><ImagePlus />Upload custom background</b></label></fieldset>
              <div className="studio-help"><Signal /><div><b>How broadcast video works</b><span>Your browser captures the device directly. LiveKit relays one secure feed to the public production view—no Zoom meeting or meeting link.</span></div></div>
            </> : <>
              <div className="studio-section-head"><span>TEAM LOOK</span><b>Every change previews immediately</b></div>
              <div className="identity-row"><label>Team name<input maxLength="36" value={form.teamName} onChange={(event) => update("teamName",event.target.value)} /></label><label>Reaction badge<input maxLength="18" value={form.badge} onChange={(event) => update("badge",event.target.value)} placeholder="WAR ROOM" /></label></div>
              <label>Team motto<input maxLength="64" value={form.motto} onChange={(event) => update("motto",event.target.value)} placeholder="Hunt · Focus · Finish" /></label>
              <div className="identity-row"><label>Favorite team<select value={form.favorite} onChange={(event) => update("favorite",event.target.value)}>{TEAM_CHOICES.map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="logo-upload"><span>Custom team logo</span><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => loadImage(event,"logo")} /><b><ImagePlus />Upload logo</b></label></div>
              {logo && <div className="studio-logo-preview"><img src={logo} alt="" /><span>ACTIVE TEAM MARK</span></div>}
              <div className="color-fields"><label>Primary color<input type="color" value={form.accent} onChange={(event) => update("accent",event.target.value)} /></label><label>Secondary color<input type="color" value={form.accent2} onChange={(event) => update("accent2",event.target.value)} /></label></div>
              <fieldset><legend>Frame style</legend><div className="style-options frame-style-options">{FRAME_STYLES.map(([style,label]) => <button type="button" className={`frame-choice style-${style} ${form.panelStyle === style ? "active" : ""}`} key={style} onClick={() => update("panelStyle",style)}><i><b /></i><span>{label}</span></button>)}</div></fieldset>
              <div className="range-grid"><label>Glow <strong>{form.intensity}%</strong><input className="intensity-range" type="range" min="20" max="100" value={form.intensity} onChange={(event) => update("intensity",event.target.value)} /></label><label>Border <strong>{form.borderWidth}px</strong><input className="intensity-range" type="range" min="1" max="8" value={form.borderWidth} onChange={(event) => update("borderWidth",event.target.value)} /></label></div>
              <fieldset><legend>Nameplate</legend><div className="style-options nameplate-options">{["classic","split","minimal"].map((style) => <button type="button" className={form.nameplate === style ? "active" : ""} key={style} onClick={() => update("nameplate",style)}>{style}</button>)}</div></fieldset>
            </>}
            <div className="studio-save-dock"><div><b>{dirty ? "Unsaved changes" : "Everything saved"}</b><span>{message && !message.includes("camera") && !message.includes("Camera") ? message : "Your saved look follows the team to every screen."}</span></div><button className="save-profile" disabled={busy || !dirty} onClick={save}><Save />{busy ? "Saving…" : dirty ? "Save changes" : "Saved"}</button></div>
          </aside>
        </div>
      )}
    </main>
  );
}
