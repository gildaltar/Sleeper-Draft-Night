import { ArrowDown, ArrowUp, ExternalLink, ListPlus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { memberForPick, playerImage, roundAndPick } from "../lib/draft";

const queueKey = (draftId, rosterId) => `sdn-draft-plan-${draftId}-${rosterId}`;

export default function DraftDesk({ data, control, rosterId, modal = false, onClose }) {
  const { players, members } = data.bootstrap;
  const draft = data.live?.draft || data.bootstrap.draft;
  const picks = control.state.mock_mode ? control.state.mock_picks || [] : data.live?.picks || [];
  const storageKey = queueKey(draft.draftId, rosterId);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("ALL");
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
  const onClock = Number(current?.rosterId) === Number(rosterId);
  const roundPick = roundAndPick(pickNo, draft.settings.teams);
  const queuePlayers = queue.map((id) => players.find((player) => player.playerId === id)).filter(Boolean);
  const visible = players.filter((player) => !drafted.has(player.playerId) && (position === "ALL" || player.position === position) && (`${player.name} ${player.team}`.toLowerCase().includes(query.toLowerCase()))).slice(0, 90);
  const add = (id) => setQueue((currentQueue) => currentQueue.includes(id) ? currentQueue : [...currentQueue, id]);
  const remove = (id) => setQueue((currentQueue) => currentQueue.filter((value) => value !== id));
  const move = (index, delta) => setQueue((currentQueue) => { const next=[...currentQueue]; const target=index+delta; if(target<0||target>=next.length)return next; [next[index],next[target]]=[next[target],next[index]]; return next; });
  const sleeperUrl = `https://sleeper.com/draft/nfl/${draft.draftId}`;
  return (
    <section className={`draft-desk ${modal ? "draft-desk-modal" : ""} ${onClock ? "is-on-clock" : ""}`}>
      <header><div><span>{onClock ? "YOU ARE ON THE CLOCK" : "PRE-DRAFT WAR ROOM"}</span><h1>{owner?.teamName || `Team ${rosterId}`} Draft Desk</h1><p>{onClock ? `Pick ${roundPick.round}.${String(roundPick.slot).padStart(2,"0")} is live. Your first queued player is ready.` : "Build a ranked plan now. Drafted players disappear automatically."}</p></div>{onClose && <button onClick={onClose} aria-label="Close Draft Desk"><X /></button>}</header>
      <div className="draft-desk-actions"><a href={sleeperUrl} target="sleeper-draft-room" rel="noreferrer"><ExternalLink />OPEN SLEEPER & CONFIRM PICK</a><span>Sleeper remains the final confirmation screen.</span></div>
      <div className="draft-desk-layout">
        <aside className="draft-queue"><div><span>MY RANKED QUEUE</span><b>{queuePlayers.length} SAVED</b></div>{queuePlayers.length ? queuePlayers.map((player,index) => <article key={player.playerId}><strong>{index+1}</strong><img src={playerImage(player.playerId,player.position)} alt="" /><div><b>{player.name}</b><span>{player.position} · {player.team}</span></div><button onClick={() => move(index,-1)} disabled={!index}><ArrowUp /></button><button onClick={() => move(index,1)} disabled={index===queuePlayers.length-1}><ArrowDown /></button><button onClick={() => remove(player.playerId)}><Trash2 /></button></article>) : <div className="empty-queue"><ListPlus /><b>Build your board</b><span>Add players from the live pool.</span></div>}</aside>
        <div className="draft-player-pool">
          <div className="draft-search"><label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search players or teams" /></label><div>{["ALL","QB","RB","WR","TE","K","DEF"].map((value) => <button className={position===value?"active":""} onClick={() => setPosition(value)} key={value}>{value}</button>)}</div></div>
          <div className="draft-player-list">{visible.map((player) => <article key={player.playerId}><img src={playerImage(player.playerId,player.position)} alt="" /><strong>{player.rank}</strong><div><b>{player.name}</b><span>{player.position} · {player.team || "FA"}</span></div><button onClick={() => add(player.playerId)} disabled={queue.includes(player.playerId)}>{queue.includes(player.playerId) ? "QUEUED" : <><ListPlus />ADD</>}</button></article>)}</div>
        </div>
      </div>
    </section>
  );
}
