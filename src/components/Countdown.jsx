import { CalendarClock, Radio, Sparkles, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import stadium from "../assets/draft-stadium.png";

const units = (milliseconds) => {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
};

export default function Countdown({ draft, league, members }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const start = Number(draft.startTime || now);
  const remaining = units(start - now);
  const startLabel = useMemo(() => new Intl.DateTimeFormat(undefined, { weekday:"long", month:"long", day:"numeric", hour:"numeric", minute:"2-digit", timeZoneName:"short" }).format(new Date(start)), [start]);
  const labels = ["CAMERAS READY", "WAR ROOMS OPEN SOON", `${members.length} TEAMS`, `${draft.settings.rounds} ROUNDS`, "ONE CHAMPION", "LIVE FROM SLEEPER"];
  return (
    <main className="countdown-show" style={{ backgroundImage:`linear-gradient(#02050a66,#02050aaa),url(${stadium})` }}>
      <div className="countdown-orbit" aria-hidden="true">{labels.map((label, index) => <span style={{ "--index":index }} key={label}>{label}</span>)}</div>
      <section className="countdown-stage">
        <div className="countdown-live"><i /><Radio size={14} /> DRAFT NIGHT PRE-SHOW</div>
        <p>{league.name}</p>
        <h1>THE CLOCK IS<br /><b>ALMOST LIVE</b></h1>
        <div className="countdown-digits" aria-label={`${remaining.days} days ${remaining.hours} hours ${remaining.minutes} minutes ${remaining.seconds} seconds`}>
          {[['DAYS',remaining.days],['HOURS',remaining.hours],['MIN',remaining.minutes],['SEC',remaining.seconds]].map(([label,value]) => <div key={label}><strong>{String(value).padStart(2,"0")}</strong><span>{label}</span></div>)}
        </div>
        <div className="countdown-meta"><span><CalendarClock />{startLabel}</span><span><Users />Doors open 90 minutes early</span><span><Sparkles />Sound on for the full show</span></div>
      </section>
      <footer><span>FULLSCREEN RECOMMENDED</span><b>THE MAIN BROADCAST OPENS AUTOMATICALLY</b></footer>
    </main>
  );
}
