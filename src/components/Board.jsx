import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { playerImage } from "../lib/draft";

export default function Board({ players, picks }) {
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("ALL");
  const picked = useMemo(() => new Set(picks.map((pick) => pick.player?.playerId)), [picks]);
  const filtered = players.filter((player) => {
    const matchesQuery = player.name.toLowerCase().includes(query.toLowerCase()) || player.team?.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (position === "ALL" || player.position === position);
  });
  return (
    <main className="content-view board-view">
      <header className="view-title"><span>LIVE PLAYER POOL</span><h1>Draft Board</h1><p>{players.length} ranked players and defenses · drafted players update from Sleeper automatically</p></header>
      <div className="board-tools">
        <label><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search player or team" /></label>
        <div>{["ALL", "QB", "RB", "WR", "TE", "K", "DEF"].map((item) => <button key={item} className={position === item ? "active" : ""} onClick={() => setPosition(item)}>{item}</button>)}</div>
      </div>
      <div className="player-table" role="table">
        <div className="player-row table-head" role="row"><span>Rank</span><span>Player</span><span>Pos</span><span>Team</span><span>Status</span></div>
        {filtered.slice(0, 96).map((player) => (
          <div className={`player-row ${picked.has(player.playerId) ? "drafted" : ""}`} role="row" key={player.playerId}>
            <strong>{player.rank}</strong>
            <span className="player-name"><img src={playerImage(player.playerId, player.position)} alt="" onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} /><b>{player.name}</b><small>{player.college || "NFL"}</small></span>
            <b className={`pos pos-${player.position}`}>{player.position}</b>
            <span>{player.team || "FA"}</span>
            <span>{picked.has(player.playerId) ? "Drafted" : player.injuryStatus || "Available"}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
