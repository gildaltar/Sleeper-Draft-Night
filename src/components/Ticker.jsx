import { Activity, Radio } from "lucide-react";

export default function Ticker({ lane, items, label, speed = 34 }) {
  const defaults =
    lane === "top"
      ? [
          { id: "status", kind: "status", text: "SLEEPER LIVE · DRAFT NIGHT", accent: "#b7ff3c" },
          { id: "format", kind: "news", text: "6 TEAMS · 22 ROUNDS · 90-SECOND CLOCK · SUPERFLEX", accent: "#1f9bfe" },
        ]
      : [
          { id: "welcome", kind: "draft", text: "WELCOME TO STROUDY DRAFT NIGHT", accent: "#b7ff3c" },
          { id: "ready", kind: "status", text: "LIVE DATA POWERED BY SLEEPER", accent: "#22c55e" },
        ];
  const laneItems = items.filter((item) => item.lane === lane);
  const content = laneItems.length ? laneItems : defaults;
  const repeated = [...content, ...content];
  return (
    <div className={`ticker ticker-${lane}`} role="marquee" aria-label={`${lane} live ticker`}>
      <div className="ticker-label">
        {lane === "top" ? <Radio size={15} /> : <Activity size={15} />}
        <span>{label || (lane === "top" ? "NEWS" : "DRAFT NIGHT")}</span>
      </div>
      <div className="ticker-window">
        <div className="ticker-track" style={{ animationDuration: `${speed}s` }}>
          {repeated.map((item, index) => (
            <div className="ticker-item" key={`${item.id}-${index}`}>
              <i style={{ background: item.accent || "#38bdf8" }} />
              <small>{String(item.kind || "news").toUpperCase()}</small>
              <b>{item.text}</b>
              <span>◆</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
