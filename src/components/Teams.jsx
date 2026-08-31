import { ArrowUpRight } from "lucide-react";
import { avatarUrl, rosterNeeds } from "../lib/draft";

export default function Teams({ league, members, picks, profiles }) {
  const profileMap = new Map(profiles.map((profile) => [Number(profile.roster_id), profile]));
  return (
    <main className="content-view teams-view">
      <header className="view-title"><span>SIX WAR ROOMS</span><h1>Teams</h1><p>See every roster need, pick position, and owner-customized team identity.</p></header>
      <div className="team-list">
        {members.map((member) => {
          const profile = profileMap.get(member.rosterId);
          const needs = rosterNeeds(league, picks, member.rosterId);
          return (
            <a href={`/team?team=${member.rosterId}`} className={`team-row style-${profile?.panel_style || "broadcast"}`} style={{ "--team": profile?.accent || `hsl(${member.rosterId * 54} 76% 58%)`, "--team-2": profile?.accent_2 || "#b7ff3c" }} key={member.userId}>
              <strong>{member.rosterId}</strong>
              <div className="team-avatar"><span>{member.displayName.slice(0, 1).toUpperCase()}</span>{member.avatar && <img src={avatarUrl(member.avatar)} alt="" onError={(event) => event.currentTarget.remove()} />}</div>
              <div><small>{profile?.badge || `TEAM ${member.rosterId}`}</small><h2>{profile?.team_name || member.teamName}</h2><p>{profile?.motto || member.displayName}</p></div>
              <div className="need-chips">{needs.slice(0, 5).map(([position, count]) => <span key={position}><b>{count}</b>{position}</span>)}</div>
              <ArrowUpRight />
            </a>
          );
        })}
      </div>
    </main>
  );
}
