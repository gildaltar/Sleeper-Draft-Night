import { Camera, Check, Eye, EyeOff, Lock, LogOut, Mic, Save, Signal, StopCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { LEAGUE_ID, TEAM_ACCENTS } from "../lib/config";
import { rosterNeeds } from "../lib/draft";
import { supabase } from "../lib/supabase";
import { startOwnerCamera } from "../hooks/useZoomDisplay";

export default function OwnerPortal({ data, control, rosterId }) {
  const member = data.bootstrap.members.find((item) => Number(item.rosterId) === Number(rosterId));
  const profile = control.profiles.find((item) => Number(item.roster_id) === Number(rosterId));
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [cameraState, setCameraState] = useState("idle");
  const cameraMount = useRef(null);
  const cameraSession = useRef(null);
  const [form, setForm] = useState({
    teamName: profile?.team_name || member?.teamName || "",
    motto: profile?.motto || "",
    badge: profile?.badge || "",
    accent: profile?.accent || TEAM_ACCENTS[rosterId - 1]?.[0] || "#1f9bfe",
    accent2: profile?.accent_2 || TEAM_ACCENTS[rosterId - 1]?.[1] || "#b7ff3c",
    panelStyle: profile?.panel_style || "broadcast",
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
    try { await invoke("update", form); await control.reload(); setMessage("Team container updated live"); }
    catch (error) { setMessage(error.message || "Could not save team profile"); }
    finally { setBusy(false); }
  };
  const startCamera = async () => {
    try {
      cameraSession.current = await startOwnerCamera({ member, mount: cameraMount.current, onStatus: (state, detail) => { setCameraState(state); setMessage(detail); } });
    } catch (error) { setCameraState("error"); setMessage(error.message || "Could not start camera"); }
  };
  const stopCamera = async () => {
    const session = cameraSession.current;
    await session?.client?.leave?.(false).catch(() => undefined);
    await session?.destroy?.().catch(() => undefined);
    cameraSession.current = null;
    cameraMount.current?.replaceChildren();
    setCameraState("idle");
  };
  const needs = useMemo(() => rosterNeeds(data.bootstrap.league, control.state.mock_mode ? control.state.mock_picks || [] : data.live?.picks || [], rosterId), [control.state, data, rosterId]);
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
    <main className="owner-portal" style={{ "--team": form.accent, "--team-2": form.accent2 }}>
      <header><div><span>TEAM {rosterId} PORTAL</span><b>Private team access</b><h1>{form.teamName}</h1><p>Owner: {member.displayName}</p></div><button onClick={() => { setUnlocked(false); setPassword(""); }}><LogOut />Sign out</button></header>
      <div className="owner-layout">
        <section className="camera-workspace">
          <div className="owner-camera" ref={cameraMount}><div className="camera-placeholder"><Camera /><b>{cameraState === "joined" ? "Camera live" : "Camera not started"}</b><small>16:9 broadcast preview</small></div></div>
          <div className="readiness"><span><Check /><b>CAMERA</b>Ready</span><span><Mic /><b>MICROPHONE</b>Ready</span><span><Signal /><b>NETWORK</b>Good</span><button disabled={cameraState === "connecting" || cameraState === "joined"} onClick={startCamera}><Camera />{cameraState === "connecting" ? "Starting…" : "Start camera"}</button><button disabled={cameraState !== "joined"} onClick={stopCamera}><StopCircle />Stop camera</button></div>
          <div className="owner-needs"><div><small>ROSTER NEEDS</small>{needs.slice(0, 7).map(([position, count]) => <span key={position}><b>{count}</b>{position}</span>)}</div><div><small>NEXT PICK</small><strong>Pick {Number(rosterId)}</strong><p>{data.bootstrap.draft.settings.pickTimer}-second clock</p></div></div>
        </section>
        <aside className="container-editor">
          <span>TEAM CONTAINER EDITOR</span>
          <label>Team name<input maxLength="36" value={form.teamName} onChange={(event) => update("teamName", event.target.value)} /></label>
          <label>Motto<input maxLength="64" value={form.motto} onChange={(event) => update("motto", event.target.value)} /></label>
          <label>Badge text<input maxLength="18" value={form.badge} onChange={(event) => update("badge", event.target.value)} /></label>
          <div className="color-fields"><label>Primary color<input type="color" value={form.accent} onChange={(event) => update("accent", event.target.value)} /></label><label>Secondary color<input type="color" value={form.accent2} onChange={(event) => update("accent2", event.target.value)} /></label></div>
          <fieldset><legend>Container style</legend><div className="style-options">{["broadcast", "carbon", "grid", "clean"].map((style) => <button type="button" className={`${style} ${form.panelStyle === style ? "active" : ""}`} key={style} onClick={() => update("panelStyle", style)}><i />{style}</button>)}</div></fieldset>
          <div className={`live-card-preview style-${form.panelStyle}`}><strong>{rosterId}</strong><i>{form.badge || member.displayName.slice(0, 3).toUpperCase()}</i><div><h2>{form.teamName}</h2><p>{form.motto || member.displayName}</p></div><span><small>PICK TIMER</small><b>1:30</b></span></div>
          <button className="save-profile" disabled={busy} onClick={save}><Save />{busy ? "Saving…" : "Save changes"}</button>
          {message && <div className={message.includes("updated") ? "form-success" : "form-error"}>{message}</div>}
        </aside>
      </div>
    </main>
  );
}
