import { Radio, Settings, ShieldCheck, Users, Volume2, VolumeX } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import Board from "./components/Board";
import Broadcast from "./components/Broadcast";
import ControlRoom from "./components/ControlRoom";
import OwnerPortal from "./components/OwnerPortal";
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
    return { path: url.pathname, team: Number(url.searchParams.get("team")) || 1 };
  }, [location]);
}

function EventAudio({ pickCount }) {
  const [enabled, setEnabled] = useState(false);
  const previous = useRef(pickCount);
  useEffect(() => {
    if (!enabled || pickCount <= previous.current) {
      previous.current = pickCount;
      return;
    }
    previous.current = pickCount;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    const gain = context.createGain();
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(420, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(680, context.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.055, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.23);
    oscillator.addEventListener("ended", () => context.close());
  }, [enabled, pickCount]);
  return (
    <button className="sound-toggle" onClick={() => setEnabled((value) => !value)} title="Event sounds only">
      {enabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
      <span>{enabled ? "CUES ON" : "CUES OFF"}</span>
    </button>
  );
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
  const nav = [["/", "Broadcast"], ["/board", "Draft board"], ["/teams", "Teams"]];
  return (
    <div className="app-shell">
      {control.state.top_ticker_enabled !== false ? <Ticker lane="top" items={control.tickers} speed={control.state.ticker_speed} /> : <div className="ticker-spacer" />}
      <header className="app-header">
        <a className="brand" href="/"><i>SDN</i><div><b>STROUDY DRAFT NIGHT</b><span>LIVE WAR ROOM</span></div></a>
        <nav>{nav.map(([href, label]) => <a className={active === href ? "active" : ""} href={href} key={href}>{label}</a>)}</nav>
        <div className="header-status"><span className={data.status === "live" ? "live" : "offline"}><i />{data.status === "live" ? "SLEEPER LIVE" : "RECONNECTING"}</span><EventAudio pickCount={picks.length} /><a href="/control" title="Commissioner controls"><Settings size={17} /></a></div>
      </header>
      <div className="app-content">{children}</div>
      {control.state.bottom_ticker_enabled !== false ? <Ticker lane="bottom" items={control.tickers} speed={Math.max(18, control.state.ticker_speed - 4)} /> : <div className="ticker-spacer" />}
      <footer className="app-footer"><span><ShieldCheck size={13} /> PRIVATE TEAM ACCESS</span><b>{data.bootstrap.league.name}</b><span><Users size={13} /> {data.bootstrap.members.length} WAR ROOMS</span></footer>
    </div>
  );
}

export default function App() {
  const route = useRoute();
  const data = useDraftData();
  const control = useBroadcastControl();
  if (!data.bootstrap) return <Loading error={data.error} />;
  if (route.path === "/control") return <ControlRoom control={control} bootstrap={data.bootstrap} live={data.live} />;
  if (route.path === "/team") return <OwnerPortal data={data} control={control} rosterId={route.team} />;
  const picks = control.state.mock_mode ? control.state.mock_picks || [] : data.live?.picks || [];
  let view = <Broadcast data={data} control={control} />;
  if (route.path === "/board" || control.state.scene === "board") view = <Board players={data.bootstrap.players} picks={picks} />;
  if (route.path === "/teams") view = <Teams league={data.bootstrap.league} members={data.bootstrap.members} picks={picks} profiles={control.profiles} />;
  if (route.path === "/spectator") view = <Broadcast data={data} control={control} spectator />;
  return <Shell data={data} control={control} active={route.path}>{view}</Shell>;
}
