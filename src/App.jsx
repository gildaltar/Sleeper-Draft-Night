import { FlaskConical, Radio, Settings, ShieldCheck, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Board from "./components/Board";
import Broadcast from "./components/Broadcast";
import ControlRoom from "./components/ControlRoom";
import DraftAudio from "./components/DraftAudio";
import OwnerPortal from "./components/OwnerPortal";
import Teams from "./components/Teams";
import TestPanel from "./components/TestPanel";
import Ticker from "./components/Ticker";
import { useBroadcastControl } from "./hooks/useBroadcastControl";
import { useDraftData } from "./hooks/useDraftData";
import { useTestControl } from "./hooks/useTestControl";

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
  const nav = [["/", "Broadcast"], ["/board", "Draft board"], ["/teams", "Teams"], ["/test", "Test Lab"]];
  return (
    <div className="app-shell">
      {control.state.top_ticker_enabled !== false ? <Ticker lane="top" items={control.tickers} speed={control.state.ticker_speed} /> : <div className="ticker-spacer" />}
      <header className="app-header">
        <a className="brand" href="/"><i>SDN</i><div><b>STROUDY DRAFT NIGHT</b><span>LIVE WAR ROOM</span></div></a>
        <nav>{nav.map(([href, label]) => <a className={active === href ? "active" : ""} href={href} key={href}>{label}</a>)}</nav>
        <div className="header-status"><span className={data.status === "live" ? "live" : "offline"}><i />{data.status === "live" ? "SLEEPER LIVE" : "RECONNECTING"}</span><DraftAudio picks={picks} draftStatus={draft.status} cue={control.state.announcement?.nonce || control.state.announcement?.title} /><a href="/test" title="Safe Test Lab"><FlaskConical size={17} /></a><a href="/control" title="Commissioner controls"><Settings size={17} /></a></div>
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
  const testControl = useTestControl(data.bootstrap);
  if (!data.bootstrap) return <Loading error={data.error} />;
  if (route.path === "/control") return <ControlRoom control={control} bootstrap={data.bootstrap} live={data.live} />;
  if (route.path === "/team") return <OwnerPortal data={data} control={control} rosterId={route.team} />;
  if (route.path === "/test/team") return <OwnerPortal data={data} control={testControl} rosterId={route.team} testMode />;
  if (route.path === "/test") {
    const testPicks = testControl.state.mock_mode ? testControl.state.mock_picks || [] : data.live?.picks || [];
    const testView = testControl.state.scene === "board"
      ? <Board players={data.bootstrap.players} picks={testPicks} />
      : <Broadcast data={data} control={testControl} testMode />;
    return <Shell data={data} control={testControl} active="/test"><div className="test-lab-stage">{testView}<TestPanel control={testControl} bootstrap={data.bootstrap} live={data.live} /></div></Shell>;
  }
  const picks = control.state.mock_mode ? control.state.mock_picks || [] : data.live?.picks || [];
  let view = <Broadcast data={data} control={control} />;
  if (route.path === "/board" || control.state.scene === "board") view = <Board players={data.bootstrap.players} picks={picks} />;
  if (route.path === "/teams") view = <Teams league={data.bootstrap.league} members={data.bootstrap.members} picks={picks} profiles={control.profiles} />;
  if (route.path === "/spectator") view = <Broadcast data={data} control={control} spectator />;
  return <Shell data={data} control={control} active={route.path}>{view}</Shell>;
}
