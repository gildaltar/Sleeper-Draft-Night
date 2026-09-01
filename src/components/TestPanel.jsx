import { ArrowLeftRight, BellRing, Camera, ChevronLeft, ChevronRight, FastForward, FlaskConical, Pause, Play, RefreshCcw, Trophy, X } from "lucide-react";
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
    if (!control.state.mock_mode) await control.updateState({ mock_mode:true, mock_picks:[], mock_draft_status:"in_progress" });
    setAutoRun(true);
  };
  const fireEvent = (event) => control.updateState({ announcement: { ...event, nonce: Date.now(), rosterId: teamId } });

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
          <p><Camera size={13} /> Camera tiles are simulated; no permission prompt or LiveKit room is used.</p>
        </section>
        <section>
          <h2>3 · Mock draft</h2>
          <div className="test-mock-status"><i className={control.state.mock_mode ? "on" : ""} /><b>{control.state.mock_mode ? "MOCK ACTIVE" : "OFFICIAL MODE"}</b><strong data-testid="test-pick-count">{control.state.mock_picks?.length || 0} picks</strong></div>
          <div className="test-button-grid">
            <button data-testid="test-start-mock" onClick={() => control.updateState({ mock_mode:true, mock_picks:[], mock_draft_status:"in_progress" })}><Play />Start</button>
            <button data-testid="test-next-pick" disabled={!control.state.mock_mode} onClick={addPick}><FastForward />Next</button>
            <button data-testid="test-auto-run" className={autoRun ? "active" : ""} onClick={autoRun ? () => setAutoRun(false) : startAuto}>{autoRun ? <Pause /> : <Play />}{autoRun ? "Stop" : "Auto"}</button>
            <button data-testid="test-end-mock" disabled={!control.state.mock_mode} onClick={() => { setAutoRun(false); control.updateState({ mock_draft_status:"complete" }); }}><Trophy />End</button>
            <button onClick={() => { setAutoRun(false); control.updateState({ mock_mode:false, mock_picks:[], mock_draft_status:null }); }}>Official</button>
          </div>
        </section>
        <section>
          <h2>4 · Show overlays</h2>
          <p>Preview every takeover exactly as viewers will see it.</p>
          <div className="test-button-grid event-buttons">
            <button onClick={() => fireEvent({ type:"trade", kicker:"TRADE ALERT", title:"A deal is on the board", detail:"Draft positions have changed hands." })}><ArrowLeftRight />Trade</button>
            <button onClick={() => fireEvent({ type:"round", kicker:"ROUND COMPLETE", title:`Round ${Math.max(1, Math.ceil((control.state.mock_picks?.length || 1) / bootstrap.members.length))} is in the books`, detail:"Reset, reload, and get ready for the next run." })}><Trophy />Round</button>
            <button onClick={() => fireEvent({ type:"announcement", kicker:"COMMISSIONER UPDATE", title:"Draft room announcement", detail:"A custom message can take over every screen." })}><BellRing />Message</button>
            <button onClick={() => control.updateState({ announcement:null })}><X />Clear</button>
          </div>
        </section>
        <section>
          <h2>5 · Team panel studio</h2>
          <label>Team<select value={teamId} onChange={(event) => setTeamId(Number(event.target.value))}>{bootstrap.members.map((member) => <option value={member.rosterId} key={member.rosterId}>Team {member.rosterId} · {member.teamName}</option>)}</select></label>
          <label>Team name<input value={profile?.team_name || ""} onChange={(event) => control.updateProfile(teamId,{team_name:event.target.value})} /></label>
          <label>Team motto<input value={profile?.motto || ""} onChange={(event) => control.updateProfile(teamId,{motto:event.target.value})} /></label>
          <div className="test-colors"><label>Primary<input type="color" value={profile?.accent || "#1f9bfe"} onChange={(event) => control.updateProfile(teamId,{accent:event.target.value})} /></label><label>Secondary<input type="color" value={profile?.accent_2 || "#b7ff3c"} onChange={(event) => control.updateProfile(teamId,{accent_2:event.target.value})} /></label></div>
          <div className="test-button-grid">{["broadcast","neon","championship","rivalry","carbon","clean"].map((style) => <button className={profile?.panel_style?.split("|")[0] === style ? "active" : ""} key={style} onClick={() => control.updateProfile(teamId,{panel_style:style})}>{style}</button>)}</div>
        </section>
        <footer><button onClick={() => { setAutoRun(false); control.reset(); }}><RefreshCcw />Reset Test Lab</button><a href={`/test/team?team=${teamId}`}>Open Team Studio</a></footer>
      </>}
    </aside>
  );
}
