import { ArrowDown, ArrowUp, CheckCircle2, ExternalLink, ListPlus, Search, Send, ShieldCheck, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LEAGUE_ID } from "../lib/config";
import { memberForPick, playerImage, roundAndPick } from "../lib/draft";
import { supabase } from "../lib/supabase";

const queueKey = (draftId, rosterId) => `sdn-draft-plan-${draftId}-${rosterId}`;

const ACTIVE_REQUESTS = new Set(["pending", "processing", "submitted"]);

export default function DraftDesk({ data, control, rosterId, modal = false, onClose, accessPassword = "" }) {
  const { players, members } = data.bootstrap;
  const draft = data.live?.draft || data.bootstrap.draft;
  const picks = data.live?.picks || [];
  const storageKey = queueKey(draft.draftId, rosterId);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("ALL");
  const [password, setPassword] = useState(accessPassword);
  const [candidate, setCandidate] = useState(null);
  const [request, setRequest] = useState(null);
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [queue, setQueue] = useState(() => { try { return JSON.parse(window.localStorage.getItem(storageKey) || "[]"); } catch { return []; } });
  const drafted = useMemo(() => new Set(picks.map((pick) => pick.player?.playerId)), [picks]);
  useEffect(() => {
    const clean = queue.filter((id) => !drafted.has(id));
    if (clean.length !== queue.length) setQueue(clean);
  }, [drafted, queue]);
  useEffect(() => { try { window.localStorage.setItem(storageKey, JSON.stringify(queue)); } catch { /* Browser storage can be unavailable. */ } }, [queue, storageKey]);
  const pickNo = picks.length + 1;
  const current = memberForPick(pickNo, draft, members);
  const owner = members.find((member) => Number(member.rosterId) === Number(rosterId));
  const onClock = draft.status === "in_progress" && Number(current?.rosterId) === Number(rosterId);
  const roundPick = roundAndPick(pickNo, draft.settings.teams);
  const queuePlayers = queue.map((id) => players.find((player) => player.playerId === id)).filter(Boolean);
  const visible = players.filter((player) => !drafted.has(player.playerId) && (position === "ALL" || player.position === position) && (`${player.name} ${player.team}`.toLowerCase().includes(query.toLowerCase()))).slice(0, 90);
  const add = (id) => setQueue((currentQueue) => currentQueue.includes(id) ? currentQueue : [...currentQueue, id]);
  const remove = (id) => setQueue((currentQueue) => currentQueue.filter((value) => value !== id));
  const move = (index, delta) => setQueue((currentQueue) => { const next=[...currentQueue]; const target=index+delta; if(target<0||target>=next.length)return next; [next[index],next[target]]=[next[target],next[index]]; return next; });
  const sleeperUrl = `https://sleeper.app/draft/nfl/${draft.draftId}`;
  const invoke = async (action, extra = {}) => {
    const result = await supabase.functions.invoke("team-access", { body:{ action,leagueId:LEAGUE_ID,rosterId:Number(rosterId),password,...extra } });
    if (result.error) throw result.error;
    if (!result.data?.ok) throw new Error(result.data?.error || "Team access failed");
    return result.data;
  };
  const requestStatus = async () => {
    if (!password || !request) return;
    const result = await invoke("pick-status", { draftId:draft.draftId });
    if (result.request) setRequest(result.request);
  };
  useEffect(() => {
    if (!request || !ACTIVE_REQUESTS.has(request.status) || !password) return undefined;
    const timer = window.setInterval(() => void requestStatus().catch(() => undefined), 1800);
    return () => window.clearInterval(timer);
  }, [password, request?.id, request?.status]);
  useEffect(() => {
    if (!request) return;
    const official = picks.find((pick) => Number(pick.pickNo) === Number(request.pick_no));
    if (!official) return;
    setRequest((currentRequest) => ({ ...currentRequest, status:String(official.player?.playerId) === String(request.player_id) ? "confirmed" : "rejected", operator_note:String(official.player?.playerId) === String(request.player_id) ? "Confirmed on Sleeper." : `Sleeper recorded ${official.player?.name || "a different player"}.` }));
  }, [picks, request?.id, request?.pick_no, request?.player_id]);
  const submitRequest = async () => {
    if (!candidate || !onClock || password.length < 6) return;
    setRequestBusy(true); setRequestMessage("");
    try {
      const result = await invoke("submit-pick", { draftId:draft.draftId,pickNo,playerId:candidate.playerId,playerName:candidate.name,position:candidate.position,nflTeam:candidate.team || "FA" });
      setRequest(result.request); setCandidate(null); setRequestMessage("Sent to the commissioner operator.");
    } catch (requestError) {
      setRequestMessage(requestError.message || "Could not submit this pick");
    } finally { setRequestBusy(false); }
  };
  const cancelRequest = async () => {
    if (!request || request.status !== "pending") return;
    setRequestBusy(true);
    try {
      await invoke("cancel-pick", { requestId:request.id });
      setRequest({ ...request, status:"cancelled" }); setRequestMessage("Request cancelled before entry.");
    } catch (requestError) { setRequestMessage(requestError.message || "Could not cancel request"); }
    finally { setRequestBusy(false); }
  };
  return (
    <section className={`draft-desk ${modal ? "draft-desk-modal" : ""} ${onClock ? "is-on-clock" : ""} ${candidate || request ? "has-request-panel" : ""}`}>
      <header><div><span>{onClock ? "YOU ARE ON THE CLOCK" : "PRE-DRAFT WAR ROOM"}</span><h1>{owner?.teamName || `Team ${rosterId}`} Draft Desk</h1><p>{onClock ? `Pick ${roundPick.round}.${String(roundPick.slot).padStart(2,"0")} is live. Your first queued player is ready.` : "Build a ranked plan now. Drafted players disappear automatically."}</p></div>{onClose && <button onClick={onClose} aria-label="Close Draft Desk"><X /></button>}</header>
      <div className="draft-desk-actions"><a href={sleeperUrl} target="sleeper-draft-room" rel="noreferrer"><ExternalLink />OPEN SLEEPER DRAFT ROOM</a>{onClock && queuePlayers[0] && !ACTIVE_REQUESTS.has(request?.status) ? <button className="queue-submit" onClick={() => setCandidate(queuePlayers[0])}><Send />SUBMIT TOP QUEUED PLAYER</button> : null}<span>{onClock ? "Submit here for commissioner entry, or use Sleeper directly." : draft.status === "pre_draft" ? "Requests unlock when Sleeper starts the draft." : "Sleeper remains the official source of truth."}</span></div>
      {(candidate || request) && <section className={`pick-request-panel status-${request?.status || "confirm"}`}>
        {request ? <>
          <div><ShieldCheck /><span>REQUEST #{request.id} · PICK {request.pick_no}</span><h2>{request.player_name}</h2><p>{request.position} · {request.nfl_team}</p></div>
          <div className="pick-request-state"><small>OPERATOR STATUS</small><strong>{request.status}</strong><span>{request.operator_note || requestMessage || "Waiting for the commissioner operator."}</span></div>
          {request.status === "pending" && <button disabled={requestBusy} onClick={cancelRequest}><X />Cancel request</button>}
          {request.status === "confirmed" && <b className="request-confirmed"><CheckCircle2 />Official Sleeper pick confirmed</b>}
        </> : <>
          <div><Send /><span>CONFIRM PICK {pickNo}</span><h2>{candidate.name}</h2><p>{candidate.position} · {candidate.team || "FA"} · {owner?.teamName}</p></div>
          {!accessPassword && <label>Team password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Required to submit" /></label>}
          <div className="pick-request-buttons"><button onClick={() => setCandidate(null)}><X />Back</button><button className="confirm" disabled={requestBusy || password.length < 6} onClick={submitRequest}><Send />{requestBusy ? "Sending…" : "Send to commissioner"}</button></div>
        </>}
        {requestMessage && request?.status !== "confirmed" && <em>{requestMessage}</em>}
      </section>}
      <div className="draft-desk-layout">
        <aside className="draft-queue"><div><span>MY RANKED QUEUE</span><b>{queuePlayers.length} SAVED</b></div>{queuePlayers.length ? queuePlayers.map((player,index) => <article key={player.playerId}><strong>{index+1}</strong><img src={playerImage(player.playerId,player.position)} alt="" /><div><b>{player.name}</b><span>{player.position} · {player.team}</span></div><button onClick={() => move(index,-1)} disabled={!index}><ArrowUp /></button><button onClick={() => move(index,1)} disabled={index===queuePlayers.length-1}><ArrowDown /></button><button onClick={() => remove(player.playerId)}><Trash2 /></button></article>) : <div className="empty-queue"><ListPlus /><b>Build your board</b><span>Add players from the live pool.</span></div>}</aside>
        <div className="draft-player-pool">
          <div className="draft-search"><label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search players or teams" /></label><div>{["ALL","QB","RB","WR","TE","K","DEF"].map((value) => <button className={position===value?"active":""} onClick={() => setPosition(value)} key={value}>{value}</button>)}</div></div>
          <div className="draft-player-list">{visible.map((player) => <article key={player.playerId}><img src={playerImage(player.playerId,player.position)} alt="" /><strong>{player.rank}</strong><div><b>{player.name}</b><span>{player.position} · {player.team || "FA"}</span></div><div className="player-row-actions"><button onClick={() => add(player.playerId)} disabled={queue.includes(player.playerId)}>{queue.includes(player.playerId) ? "QUEUED" : <><ListPlus />ADD</>}</button>{onClock && !ACTIVE_REQUESTS.has(request?.status) && <button className="pick-now" onClick={() => setCandidate(player)}><Send />PICK</button>}</div></article>)}</div>
        </div>
      </div>
    </section>
  );
}
