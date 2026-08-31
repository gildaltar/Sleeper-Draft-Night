import { AlertOctagon, FastForward, LogOut, Pause, Play, Save, Shield, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { nextMockPick } from "../lib/draft";
import { LEAGUE_ID } from "../lib/config";
import { afterAuthLock, checkCommissioner } from "../lib/controlAuth";
import { supabase } from "../lib/supabase";

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
  const [autoRun, setAutoRun] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [authIssue, setAuthIssue] = useState("");
  const [teamId, setTeamId] = useState("1");
  const [teamPassword, setTeamPassword] = useState("");
  const stateRef = useRef(control.state);
  stateRef.current = control.state;

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

  const addMockPick = async () => {
    const picks = stateRef.current.mock_picks || [];
    const pick = nextMockPick({ draft: live?.draft || bootstrap.draft, members: bootstrap.members, players: bootstrap.players, picks });
    if (!pick) { setAutoRun(false); return; }
    await control.updateState({ mock_mode: true, mock_picks: [...picks, pick] });
  };

  useEffect(() => {
    if (!autoRun || !control.state.mock_mode) return undefined;
    const timer = window.setTimeout(() => run(addMockPick, "Mock pick advanced"), 3200);
    return () => window.clearTimeout(timer);
  }, [autoRun, control.state.mock_mode, control.state.mock_picks?.length]);

  if (!ready) return <main className="loading-screen"><span>Opening secure controls…</span></main>;
  if (!session) return <><Login onReady={verifyCommissioner} />{authIssue && <div className="auth-recovery"><span>{authIssue}</span><button onClick={() => window.location.reload()}>Retry saved session</button></div>}</>;
  if (!authorized) return <main className="commissioner-login"><Shield /><h1>Commissioner access required</h1><p>This signed-in account is not registered as a commissioner.</p><button onClick={() => supabase.auth.signOut()}>Sign out</button></main>;

  return (
    <main className="control-room content-view">
      <header className="control-head"><div><span>COMMISSIONER CONTROL PLANE</span><h1>Broadcast Command Center</h1></div><button onClick={() => supabase.auth.signOut()}><LogOut size={17} />Sign out</button></header>
      {(message || error) && <div className={error ? "form-error" : "form-success"}>{error || message}</div>}
      <div className="control-grid">
        <article className="control-card panic-card">
          <h2><AlertOctagon /> Draft-night safety</h2>
          <p>Immediately switch every display to a holding screen without touching Sleeper or mock draft state.</p>
          <button className="panic" onClick={() => run(() => control.updateState({ scene: "holding" }), "Holding screen live")}>Panic / hold broadcast</button>
          <button onClick={() => run(() => control.updateState({ scene: "split", camera_layout: "rails", camera_enabled: true }), "Video + Draft restored")}>Restore Video + Draft</button>
        </article>
        <article className="control-card">
          <h2>Broadcast scene</h2>
          <div className="button-grid">{[["split","Video + Draft"],["draft","Draft only"],["cameras","Camera wall"],["board","Player board"],["holding","Holding"]].map(([value,label]) => <button className={control.state.scene === value ? "active" : ""} key={value} onClick={() => run(() => control.updateState({ scene: value }), `${label} live`)}>{label}</button>)}</div>
          <h3>Camera layout</h3>
          <div className="button-grid">{[["rails","3 + 3 rails"],["filmstrip","Filmstrip"],["wall","Camera wall"],["hidden","Hidden"]].map(([value,label]) => <button className={control.state.camera_layout === value ? "active" : ""} key={value} onClick={() => run(() => control.updateState({ camera_layout: value, camera_enabled: value !== "hidden" }), `${label} selected`)}>{label}</button>)}</div>
        </article>
        <article className="control-card mock-control">
          <h2><FastForward /> Mock draft</h2>
          <div className="mock-state"><i className={control.state.mock_mode ? "on" : ""} /><b>{control.state.mock_mode ? "MOCK MODE LIVE" : "OFFICIAL SLEEPER MODE"}</b><strong>{control.state.mock_picks?.length || 0} PICKS</strong></div>
          <div className="mock-actions">
            <button onClick={() => run(() => control.updateState({ mock_mode: true, mock_picks: [] }), "Mock mode started")}><Play />Start mock</button>
            <button disabled={!control.state.mock_mode} onClick={() => run(addMockPick, "Next mock pick added")}><FastForward />Next pick</button>
            <button disabled={!control.state.mock_mode} className={autoRun ? "active" : ""} onClick={() => setAutoRun((current) => !current)}>{autoRun ? <Pause /> : <Play />}{autoRun ? "Stop auto" : "Auto run"}</button>
            <button disabled={!control.state.mock_mode} onClick={() => run(() => control.updateState({ mock_mode: false, mock_picks: [] }), "Official Sleeper feed restored")}>Official feed</button>
          </div>
          <p>Auto run advances one synchronized pick every 3.2 seconds and stops cleanly when official mode returns.</p>
        </article>
        <article className="control-card">
          <h2><Volume2 /> Event audio</h2>
          <p>There is no continuous background track. Viewers opt in once, then hear only restrained pick and draft-state cues.</p>
        </article>
        <article className="control-card team-password-card">
          <h2>Team access passwords</h2>
          <p>Set the initial password for each owner. Passwords are bcrypt-hashed; the plaintext value is never stored.</p>
          <label>Team<select value={teamId} onChange={(event) => setTeamId(event.target.value)}>{bootstrap.members.map((member) => <option value={member.rosterId} key={member.rosterId}>Team {member.rosterId} · {member.teamName}</option>)}</select></label>
          <label>New password<input type="password" minLength="6" maxLength="72" value={teamPassword} onChange={(event) => setTeamPassword(event.target.value)} /></label>
          <button disabled={teamPassword.length < 6} onClick={() => run(async () => { const result = await supabase.rpc("set_team_password", { p_league_id: LEAGUE_ID, p_roster_id: Number(teamId), p_password: teamPassword }); if (result.error) throw result.error; setTeamPassword(""); }, "Team password saved")}><Save />Save team password</button>
        </article>
      </div>
    </main>
  );
}
