import { Clock3, Radio, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { memberForPick, playerImage, roundAndPick } from "../lib/draft";
import EventOverlay from "./EventOverlay";
import HelmetIdentity from "./HelmetIdentity";

function SleeperPickClock({ draft, picks }) {
  const [now, setNow] = useState(Date.now());
  const startedAt = picks.at(-1)?.pickedAt || draft.lastPicked || now;
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const base = Math.max(1, Number(draft.settings.pickTimer || 90));
  const running = draft.status === "in_progress" || picks.length > 0;
  const remaining = !running ? base : Math.max(0, base - Math.floor((now - Number(startedAt)) / 1000));
  return <strong>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2,"0")}</strong>;
}

export default function Spectator({ data, control }) {
  const { league, members } = data.bootstrap;
  const draft = data.live?.draft || data.bootstrap.draft;
  const picks = data.live?.picks || [];
  const pickNo = picks.length + 1;
  const current = memberForPick(pickNo, draft, members) || members[0];
  const next = memberForPick(pickNo + 1, draft, members);
  const profile = control.profiles.find((item) => Number(item.roster_id) === Number(current.rosterId));
  const previous = useRef(picks.length);
  const [pickEvent, setPickEvent] = useState(null);
  useEffect(() => {
    if (picks.length <= previous.current) { previous.current = picks.length; return undefined; }
    previous.current = picks.length;
    const pick = picks.at(-1);
    const team = members.find((member) => Number(member.rosterId) === Number(pick.rosterId));
    setPickEvent({ type:"pick", phase:"lock", pick, teamName:team?.teamName });
    const reveal = window.setTimeout(() => setPickEvent((value) => value ? { ...value, phase:"reveal" } : null), 1150);
    const dismiss = window.setTimeout(() => setPickEvent(null), 6500);
    return () => { window.clearTimeout(reveal); window.clearTimeout(dismiss); };
  }, [members, picks.length]);
  const recent = [...picks].slice(-5).reverse();
  const { round, slot } = roundAndPick(pickNo, draft.settings.teams);
  const announcement = control.state.announcement && typeof control.state.announcement === "object" ? control.state.announcement : null;
  const draftStarted = draft.status === "in_progress";
  return (
    <main className="spectator-view" style={{ "--team":profile?.accent || "#b8ff38", "--team-2":profile?.accent_2 || "#21a8ff" }}>
      <header><div><span><i /> {draftStarted ? "LIVE DRAFT COVERAGE" : "DRAFT NIGHT READY"}</span><h1>{league.name}</h1></div><div className="spectator-clock"><small>{draftStarted ? "SLEEPER PICK TIMER" : "SLEEPER TIMER SET"}</small><SleeperPickClock draft={draft} picks={picks} /></div></header>
      <section className="spectator-hero">
        <div className="spectator-team">
          <HelmetIdentity profile={profile} member={current} />
          <div><span>{draftStarted ? "ON THE CLOCK" : "FIRST PICK"} · PICK {round}.{String(slot).padStart(2,"0")}</span><h2>{profile?.team_name || current.teamName}</h2><p>{draftStarted ? `${current.displayName} is making the selection` : `${current.displayName} has the first selection`}</p></div>
        </div>
        <div className="spectator-next"><small>UP NEXT</small><b>{next?.teamName}</b><span>{next?.displayName}</span></div>
      </section>
      <section className="spectator-feed">
        <div className="spectator-feed-title"><span><Radio /> LIVE DRAFT FEED</span><b>{picks.length} PICKS COMPLETE</b></div>
        {recent.length ? recent.map((pick) => {
          const team = members.find((member) => Number(member.rosterId) === Number(pick.rosterId));
          return <article key={pick.pickNo}><img src={playerImage(pick.player.playerId,pick.player.position)} alt="" /><span>{pick.round}.{String(pick.draftSlot).padStart(2,"0")}</span><div><h3>{pick.player.name}</h3><p>{pick.player.position} · {pick.player.team} · {team?.teamName}</p></div></article>;
        }) : <div className="spectator-wait"><Sparkles /><b>The room is ready</b><span>The first selection will appear here automatically.</span></div>}
      </section>
      <footer><span><Clock3 /> Live data refreshes automatically</span><b>FULLSCREEN MAKES THIS BETTER</b></footer>
      <EventOverlay event={pickEvent || announcement} profile={control.profiles.find((item) => Number(item.roster_id) === Number(pickEvent?.pick?.rosterId || announcement?.rosterId))} />
    </main>
  );
}
