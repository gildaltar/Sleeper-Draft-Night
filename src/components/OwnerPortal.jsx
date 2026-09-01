import { Camera, Check, Eye, EyeOff, ImagePlus, ListPlus, Lock, LogOut, Mic, Save, Signal, Sparkles, StopCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import stadium from "../assets/draft-stadium.png";
import { LEAGUE_ID, TEAM_ACCENTS } from "../lib/config";
import { memberForPick, parsePanelProfile, rosterNeeds } from "../lib/draft";
import { supabase } from "../lib/supabase";
import { startOwnerCamera } from "../hooks/useZoomDisplay";
import DraftDesk from "./DraftDesk";
import HelmetIdentity from "./HelmetIdentity";

const TEAM_CHOICES = [
  ["custom","Custom identity"],["atl","Atlanta"],["buf","Buffalo"],["car","Carolina"],["chi","Chicago"],["cin","Cincinnati"],["cle","Cleveland"],["dal","Dallas"],["den","Denver"],["det","Detroit"],["gb","Green Bay"],["hou","Houston"],["ind","Indianapolis"],["jax","Jacksonville"],["kc","Kansas City"],["lv","Las Vegas"],["lac","Los Angeles Chargers"],["lar","Los Angeles Rams"],["mia","Miami"],["min","Minnesota"],["ne","New England"],["no","New Orleans"],["nyg","New York Giants"],["nyj","New York Jets"],["phi","Philadelphia"],["pit","Pittsburgh"],["sea","Seattle"],["sf","San Francisco"],["tb","Tampa Bay"],["ten","Tennessee"],["wsh","Washington"],
];

export default function OwnerPortal({ data, control, rosterId, testMode = false }) {
  const member = data.bootstrap.members.find((item) => Number(item.rosterId) === Number(rosterId));
  const profile = control.profiles.find((item) => Number(item.roster_id) === Number(rosterId));
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [unlocked, setUnlocked] = useState(testMode);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [cameraState, setCameraState] = useState("idle");
  const cameraMount = useRef(null);
  const cameraSession = useRef(null);
  const savedPanel = parsePanelProfile(profile?.panel_style);
  const [previewState, setPreviewState] = useState("normal");
  const [pickerOpen, setPickerOpen] = useState(false);
  const lastAutoOpened = useRef(0);
  const [form, setForm] = useState({
    teamName: profile?.team_name || member?.teamName || "",
    motto: profile?.motto || "",
    badge: profile?.badge || "",
    accent: profile?.accent || TEAM_ACCENTS[rosterId - 1]?.[0] || "#1f9bfe",
    accent2: profile?.accent_2 || TEAM_ACCENTS[rosterId - 1]?.[1] || "#b7ff3c",
    panelStyle: savedPanel.style,
    intensity: savedPanel.intensity,
    favorite: savedPanel.favorite,
    nameplate: savedPanel.nameplate,
    logo: savedPanel.logo,
    borderWidth: savedPanel.borderWidth,
    backgroundMode: savedPanel.backgroundMode,
    background: savedPanel.background,
  });
  useEffect(() => () => {
    const session = cameraSession.current;
    Promise.resolve(session?.client?.leave?.(false)).catch(() => undefined).finally(() => session?.destroy?.());
  }, []);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const invoke = async (action, extra = {}) => {
    const result = await supabase.functions.invoke("team-access", {
      body: { action, leagueId: LEAGUE_ID, rosterId: Number(rosterId), password, ...extra },
    });
    if (result.error) throw result.error;
    if (!result.data?.ok) throw new Error(result.data?.error || "Team access failed");
    return result.data;
  };
  const unlock = async () => {
    setBusy(true); setMessage("");
    try { await invoke("verify"); setUnlocked(true); }
    catch (error) { setMessage(error.message || "Invalid team password"); }
    finally { setBusy(false); }
  };
  const save = async () => {
    setBusy(true); setMessage("");
    try {
      const panelStyle = [form.panelStyle, form.intensity, form.favorite, form.nameplate, encodeURIComponent(form.logo || ""), form.borderWidth, form.backgroundMode, encodeURIComponent(form.background || "")].join("|");
      if (testMode) control.updateProfile(rosterId, { team_name:form.teamName, motto:form.motto, badge:form.badge, accent:form.accent, accent_2:form.accent2, panel_style:panelStyle });
      else { await invoke("update", { ...form, panelStyle }); await control.reload(); }
      setMessage(testMode ? "Team look saved in this Test Lab tab" : "Team look updated live");
    }
    catch (error) { setMessage(error.message || "Could not save team profile"); }
    finally { setBusy(false); }
  };
  const startCamera = async () => {
    if (testMode) { setCameraState("joined"); setMessage("Simulated camera ready"); return; }
    try {
      cameraSession.current = await startOwnerCamera({ member, mount: cameraMount.current, password, onStatus: (state, detail) => { setCameraState(state); setMessage(detail); } });
    } catch (error) { setCameraState("error"); setMessage(error.message || "Could not start camera"); }
  };
  const stopCamera = async () => {
    if (testMode) { setCameraState("idle"); setMessage("Simulated camera stopped"); return; }
    const session = cameraSession.current;
    await session?.client?.leave?.(false).catch(() => undefined);
    await session?.destroy?.().catch(() => undefined);
    cameraSession.current = null;
    cameraMount.current?.replaceChildren();
    setCameraState("idle");
  };
  const needs = useMemo(() => rosterNeeds(data.bootstrap.league, control.state.mock_mode ? control.state.mock_picks || [] : data.live?.picks || [], rosterId), [control.state, data, rosterId]);
  const activePicks = control.state.mock_mode ? control.state.mock_picks || [] : data.live?.picks || [];
  const activeDraft = data.live?.draft || data.bootstrap.draft;
  const isOnClock = Number(memberForPick(activePicks.length + 1, activeDraft, data.bootstrap.members)?.rosterId) === Number(rosterId);
  useEffect(() => {
    const pickNo = activePicks.length + 1;
    if (unlocked && isOnClock && lastAutoOpened.current !== pickNo) { lastAutoOpened.current = pickNo; setPickerOpen(true); }
  }, [activePicks.length, isOnClock, unlocked]);
  const logo = form.logo || (form.favorite !== "custom" ? `https://a.espncdn.com/i/teamlogos/nfl/500/${form.favorite}.png` : "");
  const loadLogo = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas"); canvas.width = 96; canvas.height = 96;
      const context = canvas.getContext("2d");
      const scale = Math.min(96 / image.width, 96 / image.height); const width = image.width * scale; const height = image.height * scale;
      context.drawImage(image, (96 - width) / 2, (96 - height) / 2, width, height);
      update("logo", canvas.toDataURL("image/webp", .72));
      URL.revokeObjectURL(image.src);
    };
    image.src = URL.createObjectURL(file);
  };
  const loadBackground = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 360;
      const context = canvas.getContext("2d");
      const scale = Math.max(640 / image.width, 360 / image.height); const width = image.width * scale; const height = image.height * scale;
      context.drawImage(image, (640 - width) / 2, (360 - height) / 2, width, height);
      update("background", canvas.toDataURL("image/webp", .62)); update("backgroundMode", "custom"); URL.revokeObjectURL(image.src);
    };
    image.src = URL.createObjectURL(file);
  };
  if (!member) return <main className="loading-screen"><span>Team not found</span></main>;

  if (!unlocked) return (
    <main className="team-gate" style={{ "--team": form.accent }}>
      <a href="/">← Back to draft</a><Lock /><span>PRIVATE TEAM ACCESS</span><h1>{member.teamName}</h1><p>Enter the commissioner-set password to open Team {rosterId}'s camera and container editor.</p>
      <label>Team password<div><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => event.key === "Enter" && unlock()} /><button aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff /> : <Eye />}</button></div></label>
      <button disabled={busy || password.length < 6} onClick={unlock}><Lock />{busy ? "Checking…" : "Unlock team room"}</button>
      {message && <div className="form-error">{message}</div>}
    </main>
  );

  return (
    <main className="owner-portal team-studio" style={{ "--team": form.accent, "--team-2": form.accent2, "--intensity": Number(form.intensity) / 100, "--frame-pct": `${form.intensity}%`, "--frame-glow": `${Number(form.intensity) * .34}px`, "--border-width":`${form.borderWidth}px` }}>
      <header><div><span>TEAM STUDIO · TEAM {rosterId}{testMode ? " · SAFE PREVIEW" : ""}</span><b>Create your identity. Own the draft night.</b><h1>{form.teamName}</h1><p>Owner: {member.displayName}</p></div>{testMode ? <a className="studio-back" href="/test">← Back to Test Lab</a> : <button onClick={() => { setUnlocked(false); setPassword(""); }}><LogOut />Sign out</button>}</header>
      <div className="owner-layout">
        <section className="camera-workspace">
          <div className="studio-preview-head"><div><span>LIVE PREVIEW</span><b>{previewState.replace("-", " ")}</b></div><div>{[["normal","Normal"],["on-clock","On the clock"],["celebration","Pick celebration"]].map(([value,label]) => <button className={previewState === value ? "active" : ""} key={value} onClick={() => setPreviewState(value)}>{label}</button>)}</div></div>
          <div className={`owner-camera studio-frame style-${form.panelStyle} preview-${previewState}`} style={{ backgroundImage: form.backgroundMode === "custom" && form.background ? `linear-gradient(#02050a44,#02050a44),url(${form.background})` : form.backgroundMode === "stadium" ? `linear-gradient(#02050a44,#02050a44),url(${stadium})` : undefined }} ref={cameraMount}><div className="camera-placeholder"><Camera /><b>{cameraState === "joined" ? "Camera live" : "Camera not started"}</b><small>16:9 broadcast preview</small></div><div className={`studio-nameplate nameplate-${form.nameplate}`}><HelmetIdentity profile={{ ...profile, team_name:form.teamName, panel_style:[form.panelStyle,form.intensity,form.favorite,form.nameplate,encodeURIComponent(form.logo||"")].join("|") }} member={member} compact /><div><strong>{form.teamName}</strong><small>{form.motto || "Make draft night yours"}</small></div><b>{form.badge || "LIVE"}</b></div>{previewState === "on-clock" && <em className="studio-state">ON THE CLOCK · 0:45</em>}{previewState === "celebration" && <div className="celebration-burst"><Sparkles /> PICK CELEBRATION</div>}</div>
          <div className="readiness"><span><Check /><b>CAMERA</b>Ready</span><span><Mic /><b>MICROPHONE</b>Ready</span><span><Signal /><b>NETWORK</b>Good</span><button disabled={cameraState === "connecting" || cameraState === "joined"} onClick={startCamera}><Camera />{cameraState === "connecting" ? "Starting…" : "Start camera"}</button><button disabled={cameraState !== "joined"} onClick={stopCamera}><StopCircle />Stop camera</button></div>
          <div className="owner-needs"><div><small>ROSTER NEEDS</small>{needs.slice(0, 7).map(([position, count]) => <span key={position}><b>{count}</b>{position}</span>)}</div><div><small>{isOnClock ? "YOU'RE UP" : "DRAFT PLAN"}</small><strong>{isOnClock ? "Pick now" : `${activePicks.length + 1} live`}</strong><button className="open-draft-desk" onClick={() => setPickerOpen(true)}><ListPlus /> Open Draft Desk</button></div></div>
        </section>
        <aside className="container-editor studio-editor">
          <span>BUILD YOUR BROADCAST LOOK</span>
          <label>Team name<input maxLength="36" value={form.teamName} onChange={(event) => update("teamName", event.target.value)} /></label>
          <label>Team motto<input maxLength="64" value={form.motto} onChange={(event) => update("motto", event.target.value)} placeholder="Hunt · Focus · Finish" /></label>
          <div className="identity-row"><label>Favorite team<select value={form.favorite} onChange={(event) => update("favorite", event.target.value)}>{TEAM_CHOICES.map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="logo-upload"><span>Custom team logo</span><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={loadLogo} /><b><ImagePlus />Upload logo</b></label></div>
          <label>Reaction badge<input maxLength="18" value={form.badge} onChange={(event) => update("badge", event.target.value)} placeholder="WAR ROOM" /></label>
          <div className="color-fields"><label>Primary color<input type="color" value={form.accent} onChange={(event) => update("accent", event.target.value)} /></label><label>Secondary color<input type="color" value={form.accent2} onChange={(event) => update("accent2", event.target.value)} /></label></div>
          <fieldset><legend>Frame style</legend><div className="style-options">{[["broadcast","Clean"],["neon","Neon"],["championship","Championship"],["rivalry","Rivalry"],["carbon","Carbon"],["grid","Grid"]].map(([style,label]) => <button type="button" className={`${style} ${form.panelStyle === style ? "active" : ""}`} key={style} onClick={() => update("panelStyle", style)}><i />{label}</button>)}</div></fieldset>
          <label>Border intensity <strong>{form.intensity}%</strong><input className="intensity-range" type="range" min="20" max="100" value={form.intensity} onChange={(event) => update("intensity", event.target.value)} /></label>
          <label>Border width <strong>{form.borderWidth}px</strong><input className="intensity-range" type="range" min="1" max="8" value={form.borderWidth} onChange={(event) => update("borderWidth", event.target.value)} /></label>
          <fieldset><legend>Camera background</legend><div className="style-options nameplate-options">{[["studio","Studio"],["stadium","Stadium"],["custom","Custom"]].map(([value,label]) => <button type="button" className={form.backgroundMode === value ? "active" : ""} key={value} onClick={() => update("backgroundMode",value)}>{label}</button>)}</div><label className="logo-upload"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={loadBackground} /><b><ImagePlus />Upload custom background</b></label></fieldset>
          <fieldset><legend>Nameplate</legend><div className="style-options nameplate-options">{["classic","split","minimal"].map((style) => <button type="button" className={form.nameplate === style ? "active" : ""} key={style} onClick={() => update("nameplate", style)}>{style}</button>)}</div></fieldset>
          <button className="save-profile" disabled={busy} onClick={save}><Save />{busy ? "Saving…" : "Save my look"}</button>
          {message && <div className={message.includes("updated") || message.includes("saved") ? "form-success" : "form-error"}>{message}</div>}
        </aside>
      </div>
      {pickerOpen && <div className="draft-desk-backdrop"><DraftDesk data={data} control={control} rosterId={rosterId} modal onClose={() => setPickerOpen(false)} /></div>}
    </main>
  );
}
