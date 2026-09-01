import { FileAudio, ListMusic, LoaderCircle, Play, SlidersHorizontal, Trash2, Upload, Volume2, VolumeX, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AUDIO_CUES, useAudioCues } from "../hooks/useAudioCues";
import { announcementCue, isDraftComplete, isDraftLive } from "../lib/audio";

const MIX_KEY = "sdn-audio-mix-v6";
const DEFAULT_MIX = Object.fromEntries(AUDIO_CUES.map(({id}) => [id,82]));
const LABELS = Object.fromEntries(AUDIO_CUES.map(({id,label}) => [id,label]));

function tone(context,destination,frequency,start,duration,volume = .05,type = "sine",endFrequency = frequency) {
  const oscillator = context.createOscillator();const gain = context.createGain();oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency,start);if (endFrequency !== frequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency,start + duration);
  gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(volume,start + .02);gain.gain.exponentialRampToValueAtTime(.0001,start + duration);
  oscillator.connect(gain).connect(destination);oscillator.start(start);oscillator.stop(start + duration + .04);
}
function noiseBoom(context,destination,start,volume = .16) {
  const length = Math.floor(context.sampleRate * .55);const buffer = context.createBuffer(1,length,context.sampleRate);const samples = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) samples[index] = (Math.random() * 2 - 1) * (1 - index / length);
  const source = context.createBufferSource();const filter = context.createBiquadFilter();const gain = context.createGain();source.buffer = buffer;filter.type = "lowpass";
  filter.frequency.setValueAtTime(520,start);filter.frequency.exponentialRampToValueAtTime(90,start + .5);gain.gain.setValueAtTime(volume,start);gain.gain.exponentialRampToValueAtTime(.0001,start + .52);
  source.connect(filter).connect(gain).connect(destination);source.start(start);
}
function synthCue(context,destination,cue) {
  const now = context.currentTime + .035;
  if (cue === "pick-in") {noiseBoom(context,destination,now,.15);[523.25,659.25,783.99].forEach((frequency,index) => tone(context,destination,frequency,now + .18 + index * .1,.42,.075,"triangle"));return;}
  if (["pick-reveal","opening","round-break","celebration"].includes(cue)) {[196,246.94,293.66,392].forEach((frequency,index) => tone(context,destination,frequency,now + index * .15,.7,.055,"sawtooth"));[392,493.88,587.33,783.99].forEach((frequency,index) => tone(context,destination,frequency,now + .72 + index * .12,.9,.045,"square"));return;}
  if (cue === "draft-start") {noiseBoom(context,destination,now,.18);[130.81,164.81,196,261.63,329.63,392,523.25].forEach((frequency,index) => tone(context,destination,frequency,now + .18 + index * .22,1.05,.052,"sawtooth"));return;}
  if (cue === "draft-end") {noiseBoom(context,destination,now,.2);[261.63,329.63,392,523.25,659.25,783.99].forEach((frequency,index) => tone(context,destination,frequency,now + .18 + index * .25,1.2,.055,index % 2 ? "triangle" : "sawtooth"));return;}
  if (cue === "announcement") {[659.25,880,1174.66].forEach((frequency,index) => tone(context,destination,frequency,now + index * .18,.58,.07,"sine"));return;}
  tone(context,destination,cue === "trade" ? 260 : 205,now,.34,.07,"square",145);tone(context,destination,293.66,now + .23,.62,.065,"square",220);
}

export default function DraftAudio({picks = [],draftStatus,announcement,panel = false}) {
  const {byCue,loading,busyCue,error,upload,remove} = useAudioCues();
  const [enabled,setEnabled] = useState(false);const [open,setOpen] = useState(panel);const [lastCue,setLastCue] = useState("");const [notice,setNotice] = useState("");
  const [mix,setMix] = useState(() => {try {return {...DEFAULT_MIX,...JSON.parse(window.localStorage.getItem(MIX_KEY) || "{}")} ;} catch {return DEFAULT_MIX;}});
  const contextRef = useRef(null);const masterGainRef = useRef(null);const mixRef = useRef(mix);const cueMapRef = useRef(byCue);const enabledRef = useRef(false);
  const revealTimerRef = useRef(null);const previousCount = useRef(picks.length);const previousStatus = useRef(draftStatus);const previousAnnouncement = useRef(announcement?.nonce);
  mixRef.current = mix;cueMapRef.current = byCue;

  const ensureAudio = useCallback(() => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;if (!AudioContext) return null;
    if (!contextRef.current) {contextRef.current = new AudioContext();masterGainRef.current = contextRef.current.createGain();masterGainRef.current.connect(contextRef.current.destination);}
    if (contextRef.current.state === "suspended") void contextRef.current.resume();return contextRef.current;
  },[]);
  const runCue = useCallback((cue,force = false) => {
    if ((!enabledRef.current && !force) || !cue) return;
    const volume = Number(mixRef.current[cue] ?? 82) / 100;const asset = cueMapRef.current.get(cue);setLastCue(LABELS[cue] || cue);
    if (asset?.public_url) {
      const player = new Audio(`${asset.public_url}${asset.public_url.includes("?") ? "&" : "?"}v=${encodeURIComponent(asset.updated_at || "1")}`);player.volume = volume;
      player.play().catch(() => {const context = ensureAudio();if (!context) return;const gain = context.createGain();gain.gain.value = volume;gain.connect(masterGainRef.current);synthCue(context,gain,cue);});return;
    }
    const context = ensureAudio();if (!context) return;const gain = context.createGain();gain.gain.value = volume;gain.connect(masterGainRef.current);synthCue(context,gain,cue);
  },[ensureAudio]);
  const previewCue = (cue) => {enabledRef.current = true;setEnabled(true);ensureAudio();window.setTimeout(() => runCue(cue,true),30);};
  const uploadCue = async (cue,file,input) => {if (!file) return;setNotice("");try {await upload(cue,file);setNotice(`${LABELS[cue]} uploaded and assigned.`);} catch { /* Hook reports the error. */ } finally {if (input) input.value = "";}};
  const removeCue = async (cue) => {setNotice("");try {await remove(cue);setNotice(`${LABELS[cue]} removed; synthesized fallback restored.`);} catch { /* Hook reports the error. */ }};

  useEffect(() => {try {window.localStorage.setItem(MIX_KEY,JSON.stringify(mix));} catch { /* Storage may be unavailable. */ }},[mix]);
  useEffect(() => {if (enabled && picks.length > previousCount.current) {runCue("pick-in");window.clearTimeout(revealTimerRef.current);revealTimerRef.current = window.setTimeout(() => runCue("pick-reveal"),1150);}previousCount.current = picks.length;},[enabled,picks.length,runCue]);
  useEffect(() => {if (enabled && isDraftLive(draftStatus) && !isDraftLive(previousStatus.current)) runCue("draft-start");if (enabled && isDraftComplete(draftStatus) && !isDraftComplete(previousStatus.current)) runCue("draft-end");previousStatus.current = draftStatus;},[draftStatus,enabled,runCue]);
  useEffect(() => {if (enabled && announcement?.nonce && announcement.nonce !== previousAnnouncement.current) runCue(announcementCue(announcement));previousAnnouncement.current = announcement?.nonce;},[announcement,enabled,runCue]);
  useEffect(() => () => {enabledRef.current = false;window.clearTimeout(revealTimerRef.current);void contextRef.current?.close?.();},[]);
  const toggle = () => {const next = !enabledRef.current;enabledRef.current = next;setEnabled(next);if (next) {ensureAudio();setOpen(true);window.setTimeout(() => runCue("announcement"),80);}};
  const popoverOpen = panel || open;

  return <div className={`audio-manager ${panel ? "audio-manager-panel" : ""}`}>
    <button className={`sound-toggle audio-director ${enabled ? "enabled" : ""}`} onClick={toggle} title={enabled ? "Mute event sounds" : "Arm event sounds"}>{enabled ? <Volume2 size={16}/> : <VolumeX size={16}/>}<span><b>{enabled ? "SHOW SOUND ON" : "SHOW SOUND OFF"}</b><small>{enabled ? "EVENT CUES ARMED" : "CLICK TO ARM CUES"}</small></span><ListMusic size={13}/></button>
    {!panel && <button className="audio-settings" onClick={() => setOpen((value) => !value)} aria-label="Open audio manager"><SlidersHorizontal/></button>}
    <div className={`audio-popover ${popoverOpen ? "open" : "closed"}`} aria-hidden={!popoverOpen}>
      <header><div><span>LIVE SHOW AUDIO</span><b>Uploaded event sounds</b></div>{!panel && <button onClick={() => setOpen(false)} aria-label="Close audio manager"><X/></button>}</header>
      {panel && <section className="audio-library"><div className="audio-library-intro"><FileAudio/><span><b>Commissioner sound library</b><small>Upload or replace one file for every show event. Files persist across devices.</small></span></div>{(notice || error) && <p className={error ? "form-error" : "form-success"}>{error || notice}</p>}<div className="audio-cue-grid">{AUDIO_CUES.map((cue) => {const asset = byCue.get(cue.id);const busy = busyCue === cue.id;return <article className={asset ? "assigned" : ""} key={cue.id}><div><b>{cue.label}</b><small>{asset?.file_name || cue.description}</small></div><div><button type="button" onClick={() => previewCue(cue.id)} disabled={busy}><Play/>Test</button><label className="audio-upload"><input type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.webm,.flac" onChange={(event) => uploadCue(cue.id,event.target.files?.[0],event.target)}/><span>{busy ? <LoaderCircle className="spin"/> : <Upload/>}{asset ? "Replace" : "Upload"}</span></label>{asset && <button type="button" className="audio-remove" onClick={() => removeCue(cue.id)} disabled={busy} aria-label={`Remove ${cue.label}`}><Trash2/></button>}</div></article>;})}</div></section>}
      <div className="audio-rule"><span>EVENT CUES</span><b>{loading ? "Loading assigned sounds…" : `${byCue.size} uploaded · ${AUDIO_CUES.length - byCue.size} synthesized fallbacks`}</b><small>{lastCue ? `Last cue: ${lastCue}` : "Arm show sound once before the draft so automatic cues can play."}</small></div>
      <div className="sound-mix-grid">{AUDIO_CUES.map(({id,label}) => <label key={id}><span>{label}<button type="button" onClick={() => previewCue(id)}>Test</button></span><strong>{mix[id]}%</strong><input type="range" min="0" max="100" value={mix[id]} onChange={(event) => setMix({...mix,[id]:Number(event.target.value)})}/></label>)}</div>
    </div>
  </div>;
}
