import { helmetFrame } from "../lib/showAssets";
import { profileLogo } from "../lib/draft";

export default function HelmetIdentity({ profile, member, compact = false }) {
  const logo = profileLogo(profile);
  return (
    <div className={`helmet-identity ${compact ? "compact" : ""}`} style={{ "--helmet-accent": profile?.accent || "#b8ff38" }}>
      <img className="helmet-shell" src={helmetFrame} alt="" />
      {logo ? <img className="helmet-team-logo" src={logo} alt="" /> : <span className="helmet-monogram">{(profile?.team_name || member?.teamName || "T").slice(0, 2).toUpperCase()}</span>}
    </div>
  );
}
