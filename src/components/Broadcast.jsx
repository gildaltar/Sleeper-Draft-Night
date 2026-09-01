import { AlertTriangle, Radio, Trophy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { draftSlotForMember, memberForPick, playerImage, rosterNeeds, roundAndPick } from "../lib/draft";
import { useZoomDisplay } from "../hooks/useZoomDisplay";
import CameraCard from "./CameraCard";
import Countdown from "./Countdown";
import EventOverlay from "./EventOverlay";
import HelmetIdentity from "./HelmetIdentity";

function PickTimer({ draft, picks }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const interval = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(interval); }, []);
  const total = Math.max(1, Number(draft.settings.pickTimer || 90));
  const pickedAt = picks.at(-1)?.pickedAt || draft.lastPicked;
  const running = draft.status === "in_progress" || picks.at(-1)?.pickedAt;
  const remaining = running && pickedAt ? Math.max(0, total - Math.floor((now - Number(pickedAt)) / 1000)) : total;
  return <><strong>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</strong><i><b style={{ width: `${Math.max(0, (remaining / total) * 100)}%` }} /></i></>;
}

function CenterStage({ league, draft, members, players, picks, currentMember, profiles, spotlight, controlState }) {
  const pickNo = picks.length + 1;
  const { round } = roundAndPick(pickNo, draft.settings.teams);
  const needs = rosterNeeds(league, picks, currentMember?.rosterId).slice(0, 8);
  const picked = new Set(picks.map((pick) => pick.player?.playerId));
  const available = players.filter((player) => !picked.has(player.playerId)).slice(0, 5);
  const lastPick = picks.at(-1);
  const nextMember = memberForPick(pickNo + 1, draft, members);
  const profile = profiles.find((item) => Number(item.roster_id) === Number(currentMember?.rosterId));
  const draftStarted = draft.status === "in_progress";
  const draftSlot = draftSlotForMember(draft, currentMember);
  return (
    <section className={`center-stage ${spotlight ? "has-spotlight" : ""}`} style={{ "--team": profile?.accent || "#1f9bfe", "--team-2": profile?.accent_2 || "#b7ff3c" }}>
      <header className="on-clock"><HelmetIdentity profile={profile} member={currentMember} compact /><div className="on-clock-copy"><span>{draftStarted ? "ON THE CLOCK" : "FIRST PICK · DRAFT NOT STARTED"}</span><h1>{profile?.team_name || currentMember?.teamName}</h1><p>{currentMember?.displayName} · Draft slot {draftSlot}</p></div><div className="pick-timer"><small>{draftStarted ? "SLEEPER PICK TIMER" : "SLEEPER TIMER SET"}</small><PickTimer draft={draft} picks={picks} /></div></header>
      {spotlight && <div className="on-clock-spotlight"><div className="spotlight-kicker"><i /> LIVE FROM THE WAR ROOM</div>{spotlight}</div>}
      <div className="intelligence-grid">
        <article><h2>ROSTER NEEDS</h2><div className="needs-list">{needs.map(([position, count]) => <span key={position}><b>{position}</b>{count} required</span>)}</div></article>
        <article><h2>LIKELY ON THE RADAR</h2><ol className="radar-list">{available.map((player) => <li key={player.playerId}><span>{player.name}</span><b>{player.position}</b></li>)}</ol></article>
        <article className="room-read"><h2>DRAFT ROOM READ</h2><p><strong>{Math.max(0, members.length - 1)} teams</strong> are tracking the same top tier. Expect the board to move quickly before {profile?.team_name || currentMember?.teamName} picks again.</p><footer><Radio size={15} /> LIVE BOARD SIGNAL</footer></article>
      </div>
      <footer className="pick-ribbon"><div><small>LAST PICK</small>{lastPick ? <span><img src={playerImage(lastPick.player.playerId,lastPick.player.position)} alt="" /><b>{lastPick.player.name}</b><em>{lastPick.player.position} · {lastPick.player.team}</em></span> : <strong>Waiting for pick 1</strong>}</div><div><small>UP NEXT</small><span><b>{nextMember?.teamName}</b><em>{nextMember?.displayName} · Pick {pickNo + 1}</em></span></div><div className="round-mark"><small>ROUND</small><strong>{round}</strong></div></footer>
    </section>
  );
}

export default function Broadcast({ data, control, spectator = false, testMode = false, preview = "" }) {
  const { league, members, players } = data.bootstrap;
  const draft = data.live?.draft || data.bootstrap.draft;
  const picks = testMode ? control.state.mock_picks || [] : data.live?.picks || [];
  const pickNo = picks.length + 1;
  const currentMember = memberForPick(pickNo, draft, members) || members[0];
  const layout = control.state.camera_layout || "rails";
  const zoom = useZoomDisplay({ members, spectator, enabled: !testMode && control.state.camera_enabled !== false && layout !== "hidden" });
  const profileByRoster = new Map(control.profiles.map((profile) => [Number(profile.roster_id), profile]));
  const previousCount = useRef(picks.length);
  const [pickEvent, setPickEvent] = useState(null);

  useEffect(() => {
    if (preview !== "reveal" || !players[0]) return;
    setPickEvent({ type:"pick", phase:"reveal", pick:{ pickNo:1, round:1, rosterId:currentMember.rosterId, player:players[0] }, teamName:currentMember.teamName });
  }, [currentMember.rosterId, currentMember.teamName, players, preview]);

  useEffect(() => {
    if (picks.length <= previousCount.current) { previousCount.current = picks.length; return undefined; }
    previousCount.current = picks.length;
    const pick = picks.at(-1);
    const team = members.find((member) => Number(member.rosterId) === Number(pick?.rosterId));
    setPickEvent({ type: "pick", phase: "lock", pick, teamName: team?.teamName });
    const reveal = window.setTimeout(() => setPickEvent((event) => event ? { ...event, phase: "reveal" } : null), 1150);
    const dismiss = window.setTimeout(() => setPickEvent(null), 5600);
    return () => { window.clearTimeout(reveal); window.clearTimeout(dismiss); };
  }, [members, picks.length]);

  const camera = (member, spotlight = false) => <CameraCard key={member.userId} member={member} draft={draft} profile={profileByRoster.get(member.rosterId)} participant={zoom.participantByRoster.get(member.rosterId)} attach={zoom.attach} active={draft.status === "in_progress" && member.rosterId === currentMember.rosterId} simulated={testMode} spotlight={spotlight} />;
  const reactionMembers = members.filter((member) => Number(member.rosterId) !== Number(currentMember.rosterId));
  const camerasVisible = control.state.scene !== "draft" && control.state.camera_enabled !== false && layout !== "hidden";
  const announcement = control.state.announcement && typeof control.state.announcement === "object" ? control.state.announcement : null;
  const event = pickEvent || announcement;
  const eventProfile = profileByRoster.get(Number(pickEvent?.pick?.rosterId || announcement?.rosterId));

  if (control.state.scene === "holding") return <main className="holding-screen"><Trophy /><span>DRAFT ROOM STANDBY</span><h1>THE WAR ROOMS ARE GETTING READY</h1><p>Live Sleeper state is preserved. The broadcast will return shortly.</p></main>;
  if (control.state.scene === "ready") return <Countdown draft={draft} league={league} members={members} />;
  if (control.state.scene === "board") return null;
  if (control.state.scene === "cameras" || (control.state.scene === "split" && layout === "wall")) return <main className="camera-wall">{members.map((member) => camera(member))}<EventOverlay event={event} profile={eventProfile} /></main>;

  const center = <CenterStage league={league} draft={draft} members={members} players={players} picks={picks} currentMember={currentMember} profiles={control.profiles} spotlight={camerasVisible ? camera(currentMember, true) : null} controlState={control.state} />;
  if (camerasVisible && layout === "filmstrip") return <main className="broadcast-filmstrip">{center}<aside className="camera-filmstrip">{reactionMembers.map((member) => camera(member))}</aside><EventOverlay event={event} profile={eventProfile} />{!testMode && zoom.message && <div className="camera-notice"><AlertTriangle size={15} />{zoom.message}</div>}</main>;
  return (
    <main className={`broadcast-grid ${camerasVisible ? "with-cameras spotlight-layout" : "draft-only"}`}>
      {camerasVisible && <aside className="camera-rail left">{reactionMembers.slice(0, 3).map((member) => camera(member))}</aside>}
      {center}
      {camerasVisible && <aside className="camera-rail right">{reactionMembers.slice(3).map((member) => camera(member))}<div className="up-next-mini"><span>UP NEXT</span><b>{memberForPick(pickNo + 1, draft, members)?.teamName}</b></div></aside>}
      <EventOverlay event={event} profile={eventProfile} />
      {!testMode && zoom.message && <div className="camera-notice"><AlertTriangle size={15} />{zoom.message}</div>}
    </main>
  );
}
