import { ExternalLink, Music2, Plus, SlidersHorizontal, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LEAGUE_ID } from "../lib/config";
import { supabase } from "../lib/supabase";

const AUDIO_KEY = "sdn-audio-enabled-v3";
const MIX_KEY = "sdn-audio-mix-v3";

function tone(context, destination, frequency, start, duration, volume = 0.04, type = "sine") {
  if (!context || !destination) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

export default function DraftAudio({ picks, draftStatus, cue }) {
  const [enabled, setEnabled] = useState(() => window.localStorage.getItem(AUDIO_KEY) === "true");
  const [open, setOpen] = useState(false);
  const [mix, setMix] = useState(() => { try { return { music: 36, sfx: 82, ...JSON.parse(window.localStorage.getItem(MIX_KEY) || "{}") }; } catch { return { music: 36, sfx: 82 }; } });
  const [playlist, setPlaylist] = useState([]);
  const [url, setUrl] = useState("");
  const [playlistMessage, setPlaylistMessage] = useState("");
  const contextRef = useRef(null);
  const musicRef = useRef(null);
  const musicGain = useRef(null);
  const sfxGain = useRef(null);
  const previousCount = useRef(picks.length);
  const previousStatus = useRef(draftStatus);
  const previousCue = useRef(cue);

  const ensureAudio = () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    if (!contextRef.current) {
      contextRef.current = new AudioContext();
      musicGain.current = contextRef.current.createGain();
      sfxGain.current = contextRef.current.createGain();
      musicGain.current.connect(contextRef.current.destination);
      sfxGain.current.connect(contextRef.current.destination);
    }
    musicGain.current.gain.value = (mix.music / 100) * 0.05;
    sfxGain.current.gain.value = mix.sfx / 100;
    if (contextRef.current.state === "suspended") void contextRef.current.resume();
    return contextRef.current;
  };

  const stopMusic = () => {
    if (!musicRef.current) return;
    window.clearInterval(musicRef.current.interval);
    musicRef.current.nodes.forEach((node) => { try { node.stop(); } catch { /* already stopped */ } });
    musicRef.current = null;
  };

  const startMusic = (context) => {
    stopMusic();
    const nodes = [55, 82.41].map((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = index ? "triangle" : "sine";
      oscillator.frequency.value = frequency;
      gain.gain.value = index ? 0.28 : 0.42;
      oscillator.connect(gain).connect(musicGain.current);
      oscillator.start();
      return oscillator;
    });
    const pulse = () => { const now = context.currentTime; [164.81, 196, 246.94].forEach((frequency, index) => tone(context, musicGain.current, frequency, now + index * 0.22, 0.5, 0.18, "triangle")); };
    pulse();
    musicRef.current = { nodes, interval: window.setInterval(pulse, 4200) };
  };

  const fanfare = (context) => [196, 246.94, 293.66, 392].forEach((frequency, index) => tone(context, sfxGain.current, frequency, context.currentTime + index * 0.13, 0.58, 0.055, "sawtooth"));
  const pickChime = (context) => { [523.25, 659.25, 783.99].forEach((frequency, index) => tone(context, sfxGain.current, frequency, context.currentTime + index * 0.085, 0.44, 0.07, "triangle")); tone(context, sfxGain.current, 1046.5, context.currentTime + 0.31, 0.72, 0.065, "sine"); };
  const alert = (context) => { tone(context, sfxGain.current, 220, context.currentTime, 0.28, 0.05, "square"); tone(context, sfxGain.current, 293.66, context.currentTime + 0.18, 0.5, 0.05, "square"); };

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    window.localStorage.setItem(AUDIO_KEY, String(next));
    if (next) { const context = ensureAudio(); if (context) { fanfare(context); startMusic(context); } } else stopMusic();
  };

  useEffect(() => { try { window.localStorage.setItem(MIX_KEY, JSON.stringify(mix)); } catch { /* no-op */ } if (contextRef.current) ensureAudio(); }, [mix]);
  useEffect(() => { supabase.from("playlist_items").select("*").eq("league_id", LEAGUE_ID).eq("active", true).order("created_at").then(({ data }) => setPlaylist(data || [])); }, []);
  useEffect(() => { if (enabled) { const context = ensureAudio(); if (context && !musicRef.current) startMusic(context); } }, [enabled]);
  useEffect(() => { if (enabled && picks.length > previousCount.current) pickChime(ensureAudio()); previousCount.current = picks.length; }, [enabled, picks.length]);
  useEffect(() => { if (enabled && draftStatus === "in_progress" && previousStatus.current !== "in_progress") fanfare(ensureAudio()); previousStatus.current = draftStatus; }, [draftStatus, enabled]);
  useEffect(() => { if (enabled && cue && cue !== previousCue.current) alert(ensureAudio()); previousCue.current = cue; }, [cue, enabled]);
  useEffect(() => () => { stopMusic(); void contextRef.current?.close?.(); }, []);

  const addTrack = async () => {
    setPlaylistMessage("");
    if (!/^https:\/\/(music\.apple\.com|open\.spotify\.com)\//i.test(url)) { setPlaylistMessage("Paste an Apple Music or Spotify link."); return; }
    const result = await supabase.from("playlist_items").insert({ league_id: LEAGUE_ID, url, requested_by: "Draft guest" }).select().single();
    if (result.error) { setPlaylistMessage("Could not add that track yet."); return; }
    setPlaylist((current) => [...current, result.data]);
    setUrl("");
    setPlaylistMessage("Added to the room playlist.");
  };

  return (
    <div className="audio-manager">
      <button className={`sound-toggle audio-director ${enabled ? "enabled" : ""}`} onClick={toggle} title={enabled ? "Mute draft music and event cues" : "Start draft music and event cues"}>{enabled ? <Volume2 size={16} /> : <VolumeX size={16} />}<span><b>{enabled ? "MUSIC + SFX" : "SOUND OFF"}</b><small>{enabled ? "LIVE MIX" : "CLICK TO START"}</small></span><Music2 size={13} className={enabled ? "audio-pulse" : ""} /></button>
      <button className="audio-settings" onClick={() => setOpen((value) => !value)} aria-label="Open audio manager"><SlidersHorizontal /></button>
      {open && <div className="audio-popover"><header><div><span>SHOW AUDIO</span><b>Music & sound effects</b></div><button onClick={() => setOpen(false)}><X /></button></header><label>Background music <strong>{mix.music}%</strong><input type="range" min="0" max="100" value={mix.music} onChange={(event) => setMix({ ...mix, music: Number(event.target.value) })} /></label><label>Event sound effects <strong>{mix.sfx}%</strong><input type="range" min="0" max="100" value={mix.sfx} onChange={(event) => setMix({ ...mix, sfx: Number(event.target.value) })} /></label><div className="playlist-manager"><span>ROOM PLAYLIST</span><p>Guests can add Apple Music or Spotify links. The commissioner chooses what plays.</p><div><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Paste a song or playlist link" /><button onClick={addTrack}><Plus /></button></div>{playlistMessage && <small>{playlistMessage}</small>}<ol>{playlist.slice(-5).map((item) => <li key={item.id}><Music2 /><span>{item.url.includes("apple") ? "Apple Music request" : "Spotify request"}</span><a href={item.url} target="_blank" rel="noreferrer"><ExternalLink /></a></li>)}</ol></div></div>}
    </div>
  );
}
