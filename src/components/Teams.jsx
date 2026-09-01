import { ArrowUpRight, Crown, ListChecks, UserRound } from "lucide-react";
import { avatarUrl, parsePanelProfile, playerImage, rosterNeeds } from "../lib/draft";
import HelmetIdentity from "./HelmetIdentity";

export default function Teams({ league, members, picks, profiles }) {
  const profileMap = new Map(profiles.map((profile) => [Number(profile.roster_id), profile]));
  return (
    <main className="content-view teams-view">
      <header className="view-title"><span>EVERY WAR ROOM · EVERY IDENTITY</span><h1>Team Headquarters</h1><p>Owners, draft positions, roster construction, recent selections, and each team's custom broadcast look.</p></header>
      <div className="team-hq-grid">
        {members.map((member) => {
          const profile = profileMap.get(member.rosterId);
          const panel = parsePanelProfile(profile?.panel_style);
          const needs = rosterNeeds(league, picks, member.rosterId);
          const drafted = picks.filter((pick) => Number(pick.rosterId) === Number(member.rosterId));
          return (
            <article className={`team-hq-card style-${panel.style}`} style={{ "--team":profile?.accent || `hsl(${member.rosterId * 54} 76% 58%)`, "--team-2":profile?.accent_2 || "#b7ff3c" }} key={member.userId}>
              <header><HelmetIdentity profile={profile} member={member} /><div><span>{profile?.badge || `TEAM ${member.rosterId}`}</span><h2>{profile?.team_name || member.teamName}</h2><p>{profile?.motto || "Ready for draft night"}</p></div><strong>{member.rosterId}</strong></header>
              <div className="team-owner"><div className="team-avatar"><span>{member.displayName.slice(0,1).toUpperCase()}</span>{member.avatar && <img src={avatarUrl(member.avatar)} alt="" onError={(event)=>event.currentTarget.remove()} />}</div><div><small><UserRound />OWNER</small><b>{member.displayName}</b><span>Draft slot {member.rosterId}</span></div><div><small><ListChecks />ROSTERED</small><b>{drafted.length}</b><span>of {league.rosterPositions.length} spots</span></div></div>
              <section><div className="team-card-label"><span>ROSTER NEEDS</span><b>{needs.reduce((sum,[,count])=>sum+count,0)} OPEN</b></div><div className="need-chips">{needs.slice(0,7).map(([position,count])=><span key={position}><b>{count}</b>{position}</span>)}</div></section>
              <section><div className="team-card-label"><span>RECENT PICKS</span><b>{drafted.length ? "LIVE" : "WAITING"}</b></div><div className="team-recent-picks">{drafted.length ? drafted.slice(-3).reverse().map((pick)=><div key={pick.pickNo}><img src={playerImage(pick.player.playerId,pick.player.position)} alt=""/><span><b>{pick.player.name}</b><small>{pick.player.position} · {pick.player.team}</small></span></div>) : <p><Crown /> First selection will land here.</p>}</div></section>
              <footer><a href={`/team?team=${member.rosterId}`}>OPEN TEAM STUDIO <ArrowUpRight /></a><a href={`/picker?team=${member.rosterId}`}>OPEN DRAFT DESK <ArrowUpRight /></a></footer>
            </article>
          );
        })}
      </div>
    </main>
  );
}
