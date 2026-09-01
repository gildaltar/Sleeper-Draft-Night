import { ArrowLeftRight, BellRing, PartyPopper, ShieldAlert, Sparkles, Trophy } from "lucide-react";
import stadium from "../assets/draft-stadium.png";
import { playerImage } from "../lib/draft";
import HelmetIdentity from "./HelmetIdentity";

const icons = { trade: ArrowLeftRight, alert: ShieldAlert, round: Trophy, celebration: PartyPopper, announcement: BellRing };

export default function EventOverlay({ event, profile }) {
  if (!event) return null;
  if (event.expiresAt && Date.now() > Number(event.expiresAt)) return null;
  const accent = profile?.accent || event.accent || "#b8ff38";
  if (event.type === "pick") {
    const player = event.pick?.player;
    return (
      <div className={`event-overlay pick-event phase-${event.phase}`} style={{ "--event": accent }} role="status" aria-live="assertive">
        <div className="event-scan" />
        <div className="pick-lock"><Sparkles /><span>THE SELECTION HAS BEEN MADE</span><h2>PICK IS <b>IN</b></h2></div>
        <div className="player-reveal" style={{ "--reveal-bg":`url(${stadium})` }}><div className="reveal-helmet"><HelmetIdentity profile={profile} member={{ teamName:event.teamName }} compact /><span>ON THE CLOCK</span></div><div className="reveal-copy"><span>ROUND {event.pick?.round} · PICK {event.pick?.pickNo}</span><h2>{player?.name}</h2><p>{player?.position} · {player?.team || "ROOKIE"}</p><strong>SELECTED BY {profile?.team_name || event.teamName}</strong></div>{player?.playerId && <img className="reveal-player" src={playerImage(player.playerId,player.position)} alt="" />}<div className="reveal-team-mark"><HelmetIdentity profile={profile} member={{ teamName:event.teamName }} /></div></div>
      </div>
    );
  }
  const Icon = icons[event.type] || BellRing;
  return (
    <div className={`event-overlay bulletin-event event-${event.type || "announcement"}`} style={{ "--event": accent }} role="status" aria-live="polite">
      <Icon />
      <span>{event.kicker || "DRAFT NIGHT UPDATE"}</span>
      <h2>{event.title}</h2>
      {event.detail && <p>{event.detail}</p>}
    </div>
  );
}
