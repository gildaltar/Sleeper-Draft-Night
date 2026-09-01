import { MicOff, VideoOff } from "lucide-react";
import { useEffect, useRef } from "react";
import { stadium } from "../lib/showAssets";
import { avatarUrl, draftSlotForMember, parsePanelProfile } from "../lib/draft";
import HelmetIdentity from "./HelmetIdentity";

export default function CameraCard({ member, draft, profile, participant, attach, active, compact = false, simulated = false, spotlight = false }) {
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
  const panel = parsePanelProfile(profile?.panel_style);
  const draftSlot = draftSlotForMember(draft, member);
  const cameraBackground = panel.backgroundMode === "custom" && panel.background ? panel.background : panel.backgroundMode === "stadium" ? stadium : "";
  return (
    <article
      className={`camera-card style-${panel.style} nameplate-${panel.nameplate} ${active ? "active" : ""} ${compact ? "compact" : ""} ${simulated ? "simulated" : ""} ${spotlight ? "spotlight-card" : ""}`}
      style={{ "--team": primary, "--team-2": secondary, "--intensity": Number(panel.intensity) / 100, "--frame-pct": `${panel.intensity}%`, "--frame-glow": `${Number(panel.intensity) * .26}px`, "--border-width":`${panel.borderWidth}px`, "--camera-bg":cameraBackground?`url(${cameraBackground})`:"none" }}
    >
      <div className="camera-frame" ref={mount}>
        {(simulated || !participant?.bVideoOn) && (
          <div className="camera-idle">
            <div className="camera-avatar"><span>{member.displayName.slice(0, 1).toUpperCase()}</span>{avatar && <img src={avatar} alt="" onError={(event) => event.currentTarget.remove()} />}</div>
            <b>{simulated ? "Simulated camera" : participant ? "Camera off" : "Waiting for owner"}</b>
          </div>
        )}
        <strong className="slot-number">{draftSlot}</strong>
        {active && <em>ON THE CLOCK</em>}
        {!simulated && <div className="media-state">
          {!participant?.bVideoOn && <VideoOff size={14} />}
          {(!participant || participant.muted) && <MicOff size={14} />}
        </div>}
      </div>
      <footer>
        <HelmetIdentity profile={profile} member={member} compact />
        <div>
          <h3>{name}</h3>
          <span>{member.displayName} · Draft slot {draftSlot}</span>
        </div>
        {profile?.badge && <b>{profile.badge}</b>}
      </footer>
    </article>
  );
}
