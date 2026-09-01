import { MicOff, VideoOff } from "lucide-react";
import { useEffect, useRef } from "react";
import { avatarUrl } from "../lib/draft";

export default function CameraCard({ member, profile, participant, attach, active, compact = false, simulated = false, spotlight = false }) {
  const mount = useRef(null);
  useEffect(() => {
    if (simulated || !participant?.bVideoOn || !mount.current) return undefined;
    attach(participant.userId, mount.current, active ? 3 : 2);
    return () => mount.current?.querySelectorAll(".zoom-video-player").forEach((node) => node.remove());
  }, [active, attach, participant?.bVideoOn, participant?.userId, simulated]);
  const primary = profile?.accent || `hsl(${member.rosterId * 54} 76% 58%)`;
  const secondary = profile?.accent_2 || "#b7ff3c";
  const name = profile?.team_name || member.teamName;
  const avatar = avatarUrl(member.avatar);
  const [panelStyle = "broadcast", intensity = "72", favorite = "custom", nameplate = "classic", encodedLogo = ""] = (profile?.panel_style || "broadcast").split("|");
  const customLogo = encodedLogo ? decodeURIComponent(encodedLogo) : "";
  const logo = customLogo || (favorite !== "custom" ? `https://a.espncdn.com/i/teamlogos/nfl/500/${favorite}.png` : "");
  return (
    <article
      className={`camera-card style-${panelStyle} nameplate-${nameplate} ${active ? "active" : ""} ${compact ? "compact" : ""} ${simulated ? "simulated" : ""} ${spotlight ? "spotlight-card" : ""}`}
      style={{ "--team": primary, "--team-2": secondary, "--intensity": Number(intensity) / 100, "--frame-pct": `${intensity}%`, "--frame-glow": `${Number(intensity) * .26}px` }}
    >
      <div className="camera-frame" ref={mount}>
        {(simulated || !participant?.bVideoOn) && (
          <div className="camera-idle">
            <div className="camera-avatar"><span>{member.displayName.slice(0, 1).toUpperCase()}</span>{avatar && <img src={avatar} alt="" onError={(event) => event.currentTarget.remove()} />}</div>
            <b>{simulated ? "Simulated camera" : participant ? "Camera off" : "Waiting for owner"}</b>
          </div>
        )}
        <strong className="slot-number">{member.rosterId}</strong>
        {active && <em>ON THE CLOCK</em>}
        {!simulated && <div className="media-state">
          {!participant?.bVideoOn && <VideoOff size={14} />}
          {(!participant || participant.muted) && <MicOff size={14} />}
        </div>}
      </div>
      <footer>
        {logo && <img className="panel-logo" src={logo} alt="" />}
        <div>
          <h3>{name}</h3>
          <span>{member.displayName} · Draft slot {member.rosterId}</span>
        </div>
        {profile?.badge && <b>{profile.badge}</b>}
      </footer>
    </article>
  );
}
