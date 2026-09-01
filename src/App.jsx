import { Expand, Radio, Settings, ShieldCheck, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Board from "./components/Board";
import Broadcast from "./components/Broadcast";
import Countdown from "./components/Countdown";
import ControlRoom from "./components/ControlRoom";
import DraftDesk from "./components/DraftDesk";
import DraftAudio from "./components/DraftAudio";
import OwnerPortal from "./components/OwnerPortal";
import Spectator from "./components/Spectator";
import Teams from "./components/Teams";
import Ticker from "./components/Ticker";
import { useBroadcastControl } from "./hooks/useBroadcastControl";
import { useDraftData } from "./hooks/useDraftData";

function useRoute() {
  const [location, setLocation] = useState(() => `${window.location.pathname}${window.location.search}`);
  useEffect(() => {
    const update = () => setLocation(`${window.location.pathname}${window.location.search}`);
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  return useMemo(() => {
    const url = new URL(location, window.location.origin);
    return { path: url.pathname, team: Number(url.searchParams.get("team")) || 1, preview: import.meta.env.DEV ? url.searchParams.get("preview") : "" };
  }, [location]);
}

function Loading({ error }) {
  return (
    <main className="loading-screen">
      <Radio />
      <span>{error ? "DRAFT FEED INTERRUPTED" : "CONNECTING TO DRAFT NIGHT"}</span>
      <h1>{error || "Loading Sleeper league, player board, and live controls…"}</h1>
      {error && <button onClick={() => window.location.reload()}>Try again</button>}
    </main>
  );
}

function Shell({ children, data, control, active }) {
  const picks = control.state.mock_mode ? control.state.mock_picks || [] : data.live?.picks || [];
  const draft = data.live?.draft || data.bootstrap.draft;
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setClock(new Date()), 1000); return () => window.clearInterval(timer); }, []);
  const nav = [["/", "Home"], ["/broadcast", "Draft"], ["/board", "Board"], ["/teams", "Teams"], ["/watch", "Watch"]];
  const tickerItems = [
    ...control.tickers,
    ...picks.slice(-8).map((pick) => ({ id:`pick-${pick.pickNo}`, lane:"bottom", kind:"pick", accent:"#b8ff38", text:`${pick.round}.${String(pick.draftSlot).padStart(2,"0")} · ${pick.player.name} · ${pick.player.position} ${pick.player.team}` })),
  ];
  const fullscreen = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  return (
    <div className="app-shell">
      {control.state.top_ticker_enabled !== false ? <Ticker lane="top" items={tickerItems} speed={control.state.ticker_speed} /> : <div className="ticker-spacer" />}
      <header className="app-header">
        <a className="brand" href="/"><i>SDN</i><div><b>STROUDY DRAFT NIGHT</b><span>LIVE WAR ROOM</span></div></a>
        <nav>{nav.map(([href, label]) => <a className={active === href ? "active" : ""} href={href} key={href}>{label}</a>)}</nav>
        <div className="header-status"><span className={data.status === "live" ? "live" : "offline"}><i />{data.status === "live" ? "SLEEPER LIVE" : "RECONNECTING"}</span><DraftAudio picks={picks} draftStatus={draft.status} cue={control.state.announcement?.nonce || control.state.announcement?.title} /><span className="header-clock">{clock.toLocaleTimeString([], { hour:"numeric", minute:"2-digit" })}</span><button className="fullscreen-button" onClick={fullscreen} title="Toggle fullscreen"><Expand size={17} /></button><a href="/control" title="Commissioner controls"><Settings size={17} /></a></div>
      </header>
      <div className="app-content">{children}</div>
      {control.state.bottom_ticker_enabled !== false ? <Ticker lane="bottom" items={tickerItems} speed={Math.max(18, control.state.ticker_speed - 4)} label={picks.length ? "DRAFT FEED" : "HEADLINES"} /> : <div className="ticker-spacer" />}
      <footer className="app-footer"><span><ShieldCheck size={13} /> PRIVATE TEAM ACCESS</span><b>{data.bootstrap.league.name}</b><span><Users size={13} /> {data.bootstrap.members.length} WAR ROOMS</span></footer>
    </div>
  );
}

export default function App() {
  const route = useRoute();
  const data = useDraftData();
  const control = useBroadcastControl();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 15000); return () => window.clearInterval(timer); }, []);
  if (!data.bootstrap) return <Loading error={data.error} />;
  if (route.path === "/control") return <ControlRoom control={control} bootstrap={data.bootstrap} live={data.live} />;
  if (route.path === "/team") return <OwnerPortal data={data} control={control} rosterId={route.team} />;
  const picks = control.state.mock_mode ? control.state.mock_picks || [] : data.live?.picks || [];
  let view = <Broadcast data={data} control={control} preview={route.preview} />;
  const draft = data.live?.draft || data.bootstrap.draft;
  const preshow = draft.status === "pre_draft" && now < Number(draft.startTime) - 90 * 60 * 1000;
  if (route.path === "/" && preshow) view = <Countdown draft={draft} league={data.bootstrap.league} members={data.bootstrap.members} />;
  if (route.path === "/watch" || route.path === "/spectator") view = <Spectator data={data} control={control} />;
  if (route.path === "/picker") view = <DraftDesk data={data} control={control} rosterId={route.team} />;
  if (route.path === "/board" || control.state.scene === "board") view = <Board players={data.bootstrap.players} picks={picks} />;
  if (route.path === "/teams") view = <Teams league={data.bootstrap.league} members={data.bootstrap.members} picks={picks} profiles={control.profiles} />;
  return <Shell data={data} control={control} active={route.path}>{view}</Shell>;
}
