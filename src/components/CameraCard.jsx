import { MicOff, VideoOff } from "lucide-react";
import { useEffect, useRef } from "react";
import { avatarUrl } from "../lib/draft";

export default function CameraCard({ member, profile, participant, attach, active, compact = false, simulated = false }) {
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
  return (
    <article
      className={`camera-card style-${profile?.panel_style || "broadcast"} ${active ? "active" : ""} ${compact ? "compact" : ""} ${simulated ? "simulated" : ""}`}
      style={{ "--team": primary, "--team-2": secondary }}
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
        <div>
          <h3>{name}</h3>
          <span>{member.displayName} · Draft slot {member.rosterId}</span>
        </div>
        {profile?.badge && <b>{profile.badge}</b>}
      </footer>
    </article>
  );
}
