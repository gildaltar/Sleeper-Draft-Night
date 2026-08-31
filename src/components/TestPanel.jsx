import { Camera, ChevronLeft, ChevronRight, FastForward, FlaskConical, Pause, Play, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { nextMockPick } from "../lib/draft";

export default function TestPanel({ control, bootstrap, live }) {
  const [open, setOpen] = useState(true);
  const [autoRun, setAutoRun] = useState(false);
  const [teamId, setTeamId] = useState(1);
  const stateRef = useRef(control.state);
  stateRef.current = control.state;

  const addPick = useCallback(async () => {
    const picks = stateRef.current.mock_picks || [];
    const pick = nextMockPick({ draft: live?.draft || bootstrap.draft, members: bootstrap.members, players: bootstrap.players, picks });
    if (!pick) { setAutoRun(false); return; }
    await control.updateState({ mock_mode: true, mock_picks: [...picks, pick] });
  }, [bootstrap, control, live]);

  useEffect(() => {
    if (!autoRun || !control.state.mock_mode) return undefined;
    const timer = window.setTimeout(() => void addPick(), 1200);
    return () => window.clearTimeout(timer);
  }, [addPick, autoRun, control.state.mock_mode, control.state.mock_picks?.length]);

  const profile = control.profiles.find((item) => Number(item.roster_id) === Number(teamId));
  const setScene = (scene) => control.updateState({ scene });
  const startAuto = async () => {
    if (!control.state.mock_mode) await control.updateState({ mock_mode: true, mock_picks: [] });
    setAutoRun(true);
  };

  return (
    <aside className={`test-panel ${open ? "open" : "closed"}`} data-testid="test-panel">
      <button className="test-panel-toggle" onClick={() => setOpen((value) => !value)} aria-label={open ? "Close test controls" : "Open test controls"}>{open ? <ChevronRight /> : <ChevronLeft />}</button>
      {open && <>
        <header><FlaskConical /><div><span>SAFE LOCAL SANDBOX</span><h1>Test Lab</h1></div></header>
        <p className="test-safety">These controls affect only this browser tab. They never write to Supabase or the live draft.</p>
        <section>
          <h2>1 · Broadcast scenes</h2>
          <div className="test-button-grid">{[["split","Video + Draft"],["draft","Draft only"],["cameras","Camera wall"],["board","Player board"],["holding","Holding"]].map(([value,label]) => <button className={control.state.scene === value ? "active" : ""} key={value} onClick={() => setScene(value)}>{label}</button>)}</div>
        </section>
        <section>
          <h2>2 · Camera layout</h2>
          <div className="test-button-grid">{[["rails","3 + 3 rails"],["filmstrip","Filmstrip"],["wall","Wall"],["hidden","Hidden"]].map(([value,label]) => <button className={control.state.camera_layout === value ? "active" : ""} key={value} onClick={() => control.updateState({ camera_layout:value, camera_enabled:value !== "hidden" })}>{label}</button>)}</div>
          <p><Camera size={13} /> Camera tiles are simulated; no permission prompt or Zoom session is used.</p>
        </section>
        <section>
          <h2>3 · Mock draft</h2>
          <div className="test-mock-status"><i className={control.state.mock_mode ? "on" : ""} /><b>{control.state.mock_mode ? "MOCK ACTIVE" : "OFFICIAL MODE"}</b><strong data-testid="test-pick-count">{control.state.mock_picks?.length || 0} picks</strong></div>
          <div className="test-button-grid">
            <button data-testid="test-start-mock" onClick={() => control.updateState({ mock_mode:true, mock_picks:[] })}><Play />Start</button>
            <button data-testid="test-next-pick" disabled={!control.state.mock_mode} onClick={addPick}><FastForward />Next</button>
            <button data-testid="test-auto-run" className={autoRun ? "active" : ""} onClick={autoRun ? () => setAutoRun(false) : startAuto}>{autoRun ? <Pause /> : <Play />}{autoRun ? "Stop" : "Auto"}</button>
            <button onClick={() => { setAutoRun(false); control.updateState({ mock_mode:false, mock_picks:[] }); }}>Official</button>
          </div>
        </section>
        <section>
          <h2>4 · Team container</h2>
          <label>Team<select value={teamId} onChange={(event) => setTeamId(Number(event.target.value))}>{bootstrap.members.map((member) => <option value={member.rosterId} key={member.rosterId}>Team {member.rosterId} · {member.teamName}</option>)}</select></label>
          <div className="test-colors"><label>Primary<input type="color" value={profile?.accent || "#1f9bfe"} onChange={(event) => control.updateProfile(teamId,{accent:event.target.value})} /></label><label>Secondary<input type="color" value={profile?.accent_2 || "#b7ff3c"} onChange={(event) => control.updateProfile(teamId,{accent_2:event.target.value})} /></label></div>
          <div className="test-button-grid">{["broadcast","carbon","grid","clean"].map((style) => <button className={profile?.panel_style === style ? "active" : ""} key={style} onClick={() => control.updateProfile(teamId,{panel_style:style})}>{style}</button>)}</div>
        </section>
        <footer><button onClick={() => { setAutoRun(false); control.reset(); }}><RefreshCcw />Reset Test Lab</button><a href="/control">Open live controls</a></footer>
      </>}
    </aside>
  );
}
