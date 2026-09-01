import { ExternalLink, ListMusic, SlidersHorizontal, Volume2, VolumeX, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { announcementCue, isDraftComplete, isDraftLive } from "../lib/audio";

const MIX_KEY = "sdn-audio-mix-v5";
const APPLE_MUSIC_URL = "https://music.apple.com/us/album/here-we-go-steeler-fight-song-2023-2024-single/1725108398";
const APPLE_EMBED_URL = "https://embed.music.apple.com/us/album/here-we-go-steeler-fight-song-2023-2024-single/1725108398";
const DEFAULT_MIX = {pickIn:82,pickReveal:86,draftStart:90,draftEnd:90,announcement:78};
const CUE_LABEL = {"pick-in":"Pick is in","pick-reveal":"Pick reveal","draft-start":"Draft start","draft-end":"Draft end",announcement:"Announcement",alert:"Alert",fanfare:"Fanfare"};
const CUE_MIX = {"pick-in":"pickIn","pick-reveal":"pickReveal",fanfare:"pickReveal","draft-start":"draftStart","draft-end":"draftEnd",announcement:"announcement",alert:"announcement"};
const MIX_CONTROLS = [
  ["pickIn","Pick is in","pick-in"],["pickReveal","Pick reveal","pick-reveal"],
  ["draftStart","Draft start","draft-start"],["draftEnd","Draft end","draft-end"],["announcement","Announcements","announcement"],
];

function PreDraftAppleMusic({draftStatus}) {
  const draftLive = isDraftLive(draftStatus) || isDraftComplete(draftStatus);
  return (
    <section className="predraft-apple-player">
      <header><div className="apple-music-mark">♫</div><span><small>PRE-DRAFT MUSIC</small><b>Here We Go! (Steeler Fight Song 2023–2024)</b><em>Roger Wood · Apple Music</em></span><a href={APPLE_MUSIC_URL} target="apple-music-track" rel="noreferrer" aria-label="Open song in Apple Music"><ExternalLink /></a></header>
      {!draftLive ? <iframe title="Here We Go Steelers 2023-2024 on Apple Music" src={APPLE_EMBED_URL} allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write" sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation" loading="lazy" /> : <div className="predraft-player-closed"><b>Draft is live</b><span>The pre-draft music player is hidden so it cannot interfere with pick and reveal cues.</span></div>}
      <p>Press play in the Apple player before the draft. Browser autoplay rules require a manual start. The embed uses the production device’s volume; the sliders below control the draft-night sound cues.</p>
    </section>
  );
}

function tone(context,destination,frequency,start,duration,volume = .05,type = "sine",endFrequency = frequency) {
  if (!context || !destination) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency,start);
  if (endFrequency !== frequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency,start + duration);
  gain.gain.setValueAtTime(.0001,start);
  gain.gain.exponentialRampToValueAtTime(volume,start + .02);
  gain.gain.exponentialRampToValueAtTime(.0001,start + duration);
  oscillator.connect(gain).connect(destination);
  oscillator.start(start);oscillator.stop(start + duration + .04);
}
function noiseBoom(context,destination,start,volume = .16) {
  const length = Math.floor(context.sampleRate * .55);
  const buffer = context.createBuffer(1,length,context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) samples[index] = (Math.random() * 2 - 1) * (1 - index / length);
  const source = context.createBufferSource();const filter = context.createBiquadFilter();const gain = context.createGain();
  source.buffer = buffer;filter.type = "lowpass";filter.frequency.setValueAtTime(520,start);filter.frequency.exponentialRampToValueAtTime(90,start + .5);
  gain.gain.setValueAtTime(volume,start);gain.gain.exponentialRampToValueAtTime(.0001,start + .52);
  source.connect(filter).connect(gain).connect(destination);source.start(start);
}
function playCue(context,destination,cue) {
  const now = context.currentTime + .035;
  if (cue === "pick-in") {
    noiseBoom(context,destination,now,.15);
    [523.25,659.25,783.99].forEach((frequency,index) => tone(context,destination,frequency,now + .18 + index * .1,.42,.075,"triangle"));
    tone(context,destination,1046.5,now + .48,.55,.07,"sine");return;
  }
  if (cue === "pick-reveal" || cue === "fanfare") {
    [196,246.94,293.66,392].forEach((frequency,index) => tone(context,destination,frequency,now + index * .15,.7,.055,"sawtooth"));
    [392,493.88,587.33,783.99].forEach((frequency,index) => tone(context,destination,frequency,now + .72 + index * .12,.9,.045,"square"));return;
  }
  if (cue === "draft-start") {
    noiseBoom(context,destination,now,.18);
    [130.81,164.81,196,261.63,329.63,392,523.25].forEach((frequency,index) => tone(context,destination,frequency,now + .18 + index * .22,1.05,.052,"sawtooth"));
    tone(context,destination,1046.5,now + 1.72,1.2,.06,"triangle");return;
  }
  if (cue === "draft-end") {
    noiseBoom(context,destination,now,.2);
    [261.63,329.63,392,523.25,659.25,783.99].forEach((frequency,index) => tone(context,destination,frequency,now + .18 + index * .25,1.2,.055,index % 2 ? "triangle" : "sawtooth"));
    [523.25,659.25,783.99,1046.5].forEach((frequency) => tone(context,destination,frequency,now + 1.85,1.55,.04,"triangle"));return;
  }
  if (cue === "announcement") {
    [659.25,880,1174.66].forEach((frequency,index) => tone(context,destination,frequency,now + index * .18,.58,.07,"sine"));return;
  }
  tone(context,destination,205,now,.34,.07,"square",145);tone(context,destination,293.66,now + .23,.62,.065,"square",220);
}

export default function DraftAudio({picks = [],draftStatus,announcement,panel = false}) {
  const [enabled,setEnabled] = useState(false);
  const [open,setOpen] = useState(panel);
  const [mix,setMix] = useState(() => {
    try {return {...DEFAULT_MIX,...JSON.parse(window.localStorage.getItem(MIX_KEY) || "{}")};}
    catch {return DEFAULT_MIX;}
  });
  const [lastCue,setLastCue] = useState("");
  const contextRef = useRef(null);const masterGainRef = useRef(null);const mixRef = useRef(mix);
  const enabledRef = useRef(false);
  const revealTimerRef = useRef(null);const previousCount = useRef(picks.length);const previousStatus = useRef(draftStatus);const previousAnnouncement = useRef(announcement?.nonce);
  mixRef.current = mix;

  const ensureAudio = useCallback(() => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    if (!contextRef.current) {
      contextRef.current = new AudioContext();
      masterGainRef.current = contextRef.current.createGain();
      masterGainRef.current.connect(contextRef.current.destination);
    }
    if (contextRef.current.state === "suspended") void contextRef.current.resume();
    return contextRef.current;
  },[]);
  const runCue = useCallback((cue) => {
    if (!enabledRef.current || !cue) return;
    const context = ensureAudio();
    if (!context) return;
    const cueGain = context.createGain();
    cueGain.gain.value = Number(mixRef.current[CUE_MIX[cue]] ?? 80) / 100;
    cueGain.connect(masterGainRef.current);
    playCue(context,cueGain,cue);
    setLastCue(CUE_LABEL[cue] || cue);
  },[ensureAudio]);
  const previewCue = (cue) => {
    enabledRef.current = true;setEnabled(true);ensureAudio();window.setTimeout(() => runCue(cue),30);
  };
  useEffect(() => {
    try {window.localStorage.setItem(MIX_KEY,JSON.stringify(mix));} catch { /* Storage may be unavailable. */ }
  },[mix]);
  useEffect(() => {
    if (enabled && picks.length > previousCount.current) {
      runCue("pick-in");window.clearTimeout(revealTimerRef.current);revealTimerRef.current = window.setTimeout(() => runCue("pick-reveal"),1150);
    }
    previousCount.current = picks.length;
  },[enabled,picks.length,runCue]);
  useEffect(() => {
    if (enabled && isDraftLive(draftStatus) && !isDraftLive(previousStatus.current)) runCue("draft-start");
    if (enabled && isDraftComplete(draftStatus) && !isDraftComplete(previousStatus.current)) runCue("draft-end");
    previousStatus.current = draftStatus;
  },[draftStatus,enabled,runCue]);
  useEffect(() => {
    if (enabled && announcement?.nonce && announcement.nonce !== previousAnnouncement.current) runCue(announcementCue(announcement));
    previousAnnouncement.current = announcement?.nonce;
  },[announcement,enabled,runCue]);
  useEffect(() => () => {
    enabledRef.current = false;window.clearTimeout(revealTimerRef.current);void contextRef.current?.close?.();
  },[]);

  const toggle = () => {
    const next = !enabledRef.current;enabledRef.current = next;setEnabled(next);
    if (!next) return;
    ensureAudio();setOpen(true);window.setTimeout(() => runCue("announcement"),80);
  };
  const popoverOpen = panel || open;
  return (
    <div className={`audio-manager ${panel ? "audio-manager-panel" : ""}`}>
      <button className={`sound-toggle audio-director ${enabled ? "enabled" : ""}`} onClick={toggle} title={enabled ? "Mute draft music and event cues" : "Start draft music and event cues"}>
        {enabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        <span><b>{enabled ? "SHOW SOUND ON" : "SHOW SOUND OFF"}</b><small>{enabled ? "EVENT CUES ARMED" : "CLICK TO ARM CUES"}</small></span>
        <ListMusic size={13} />
      </button>
      {!panel && <button className="audio-settings" onClick={() => setOpen((value) => !value)} aria-label="Open audio manager"><SlidersHorizontal /></button>}
      <div className={`audio-popover ${popoverOpen ? "open" : "closed"}`} aria-hidden={!popoverOpen}>
        <header><div><span>LIVE SHOW AUDIO</span><b>Pre-draft music & event cues</b></div>{!panel && <button onClick={() => setOpen(false)} aria-label="Close audio manager"><X /></button>}</header>
        <PreDraftAppleMusic draftStatus={draftStatus} />
        <div className="audio-rule"><span>EVENT CUES</span><b>Pick in · Reveal · Start · End · Announcement</b><small>{lastCue ? `Last cue: ${lastCue}` : "Arm show sound before the draft so automatic cues can play."}</small></div>
        <div className="sound-mix-grid">{MIX_CONTROLS.map(([key,label,cue]) => <label key={key}><span>{label}{cue && <button type="button" onClick={() => previewCue(cue)}>Test</button>}</span><strong>{mix[key]}%</strong><input type="range" min="0" max="100" value={mix[key]} onChange={(event) => setMix({...mix,[key]:Number(event.target.value)})} /></label>)}</div>
      </div>
    </div>
  );
}
