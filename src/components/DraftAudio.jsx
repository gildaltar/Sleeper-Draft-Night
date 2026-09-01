import { ListMusic, Plus, SlidersHorizontal, Volume2, VolumeX, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import SpotifyQueuePlayer from "./SpotifyQueuePlayer";
import { announcementCue, isDraftComplete, normalizeSpotifyTrackUrl } from "../lib/audio";
import { LEAGUE_ID } from "../lib/config";
import { supabase } from "../lib/supabase";

const MIX_KEY = "sdn-audio-mix-v4";
const CUE_LENGTH = {
  "pick-in": 1050,
  "pick-reveal": 2200,
  "draft-start": 3100,
  "draft-end": 3600,
  announcement: 1250,
  alert: 1200,
  fanfare: 2200,
};
const CUE_LABEL = {
  "pick-in": "Pick is in",
  "pick-reveal": "Pick reveal",
  "draft-start": "Draft start",
  "draft-end": "Draft end",
  announcement: "Announcement",
  alert: "Alert",
  fanfare: "Fanfare",
};

function tone(context, destination, frequency, start, duration, volume = 0.05, type = "sine", endFrequency = frequency) {
  if (!context || !destination) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (endFrequency !== frequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.04);
}

function noiseBoom(context, destination, start, volume = 0.16) {
  const length = Math.floor(context.sampleRate * 0.55);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) samples[index] = (Math.random() * 2 - 1) * (1 - index / length);
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = buffer;
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(520, start);
  filter.frequency.exponentialRampToValueAtTime(90, start + 0.5);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.52);
  source.connect(filter).connect(gain).connect(destination);
  source.start(start);
}

function playCue(context, destination, cue) {
  const now = context.currentTime + 0.035;
  if (cue === "pick-in") {
    noiseBoom(context, destination, now, 0.15);
    [523.25, 659.25, 783.99].forEach((frequency, index) => tone(context, destination, frequency, now + 0.18 + index * 0.1, 0.42, 0.075, "triangle"));
    tone(context, destination, 1046.5, now + 0.48, 0.55, 0.07, "sine");
    return;
  }
  if (cue === "pick-reveal" || cue === "fanfare") {
    [196, 246.94, 293.66, 392].forEach((frequency, index) => tone(context, destination, frequency, now + index * 0.15, 0.7, 0.055, "sawtooth"));
    [392, 493.88, 587.33, 783.99].forEach((frequency, index) => tone(context, destination, frequency, now + 0.72 + index * 0.12, 0.9, 0.045, "square"));
    return;
  }
  if (cue === "draft-start") {
    noiseBoom(context, destination, now, 0.18);
    [130.81, 164.81, 196, 261.63, 329.63, 392, 523.25].forEach((frequency, index) => tone(context, destination, frequency, now + 0.18 + index * 0.22, 1.05, 0.052, "sawtooth"));
    tone(context, destination, 1046.5, now + 1.72, 1.2, 0.06, "triangle");
    return;
  }
  if (cue === "draft-end") {
    noiseBoom(context, destination, now, 0.2);
    [261.63, 329.63, 392, 523.25, 659.25, 783.99].forEach((frequency, index) => tone(context, destination, frequency, now + 0.18 + index * 0.25, 1.2, 0.055, index % 2 ? "triangle" : "sawtooth"));
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency) => tone(context, destination, frequency, now + 1.85, 1.55, 0.04, "triangle"));
    return;
  }
  if (cue === "announcement") {
    [659.25, 880, 1174.66].forEach((frequency, index) => tone(context, destination, frequency, now + index * 0.18, 0.58, 0.07, "sine"));
    return;
  }
  tone(context, destination, 205, now, 0.34, 0.07, "square", 145);
  tone(context, destination, 293.66, now + 0.23, 0.62, 0.065, "square", 220);
}

export default function DraftAudio({ picks = [], draftStatus, announcement }) {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [mix, setMix] = useState(() => {
    try { return { sfx:82, ...JSON.parse(window.localStorage.getItem(MIX_KEY) || "{}") }; }
    catch { return { sfx:82 }; }
  });
  const [playlist, setPlaylist] = useState([]);
  const [url, setUrl] = useState("");
  const [playlistMessage, setPlaylistMessage] = useState("");
  const [playerState, setPlayerState] = useState({ ready:false, playing:false, message:"Loading queue…", queueLength:0 });
  const [lastCue, setLastCue] = useState("");
  const contextRef = useRef(null);
  const sfxGainRef = useRef(null);
  const spotifyRef = useRef(null);
  const enabledRef = useRef(false);
  const playerReadyRef = useRef(false);
  const playerPlayingRef = useRef(false);
  const pausedForCueRef = useRef(false);
  const resumeTimerRef = useRef(null);
  const revealTimerRef = useRef(null);
  const previousCount = useRef(picks.length);
  const previousStatus = useRef(draftStatus);
  const previousAnnouncement = useRef(announcement?.nonce);

  const ensureAudio = useCallback(() => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    if (!contextRef.current) {
      contextRef.current = new AudioContext();
      sfxGainRef.current = contextRef.current.createGain();
      sfxGainRef.current.connect(contextRef.current.destination);
    }
    sfxGainRef.current.gain.value = mix.sfx / 100;
    if (contextRef.current.state === "suspended") void contextRef.current.resume();
    return contextRef.current;
  }, [mix.sfx]);

  const runCue = useCallback((cue, { resumeAfter = true } = {}) => {
    if (!enabledRef.current || !cue) return;
    const context = ensureAudio();
    if (!context) return;
    window.clearTimeout(resumeTimerRef.current);
    if (playerReadyRef.current && playerPlayingRef.current && !pausedForCueRef.current) {
      spotifyRef.current?.pause();
      pausedForCueRef.current = true;
    }
    playCue(context, sfxGainRef.current, cue);
    setLastCue(CUE_LABEL[cue] || cue);
    if (resumeAfter) {
      resumeTimerRef.current = window.setTimeout(() => {
        if (enabledRef.current && pausedForCueRef.current) spotifyRef.current?.resume();
        pausedForCueRef.current = false;
      }, CUE_LENGTH[cue] || 1400);
    }
  }, [ensureAudio]);

  const handlePlayerState = useCallback((next) => {
    playerReadyRef.current = next.ready;
    playerPlayingRef.current = next.playing;
    setPlayerState(next);
  }, []);

  const reloadPlaylist = useCallback(async () => {
    const { data } = await supabase.from("playlist_items").select("*").eq("league_id", LEAGUE_ID).eq("active", true).order("created_at");
    setPlaylist(data || []);
  }, []);

  useEffect(() => {
    void reloadPlaylist();
    const channel = supabase.channel(`draft-audio-${LEAGUE_ID}`)
      .on("postgres_changes", { event:"*", schema:"public", table:"playlist_items", filter:`league_id=eq.${LEAGUE_ID}` }, reloadPlaylist)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [reloadPlaylist]);

  useEffect(() => {
    try { window.localStorage.setItem(MIX_KEY, JSON.stringify(mix)); } catch { /* storage may be unavailable */ }
    if (sfxGainRef.current) sfxGainRef.current.gain.value = mix.sfx / 100;
  }, [mix]);

  useEffect(() => {
    if (enabled && picks.length > previousCount.current) {
      runCue("pick-in", { resumeAfter:false });
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = window.setTimeout(() => runCue("pick-reveal"), 1150);
    }
    previousCount.current = picks.length;
  }, [enabled, picks.length, runCue]);

  useEffect(() => {
    if (enabled && draftStatus === "in_progress" && previousStatus.current !== "in_progress") runCue("draft-start");
    if (enabled && isDraftComplete(draftStatus) && !isDraftComplete(previousStatus.current)) runCue("draft-end");
    previousStatus.current = draftStatus;
  }, [draftStatus, enabled, runCue]);

  useEffect(() => {
    if (enabled && announcement?.nonce && announcement.nonce !== previousAnnouncement.current) runCue(announcementCue(announcement));
    previousAnnouncement.current = announcement?.nonce;
  }, [announcement, enabled, runCue]);

  useEffect(() => () => {
    enabledRef.current = false;
    window.clearTimeout(resumeTimerRef.current);
    window.clearTimeout(revealTimerRef.current);
    void contextRef.current?.close?.();
  }, []);

  const toggle = () => {
    const next = !enabledRef.current;
    enabledRef.current = next;
    setEnabled(next);
    if (!next) {
      pausedForCueRef.current = false;
      spotifyRef.current?.pause();
      return;
    }
    ensureAudio();
    setOpen(true);
    spotifyRef.current?.play();
    window.setTimeout(() => runCue("announcement"), 80);
  };

  const addTrack = async () => {
    setPlaylistMessage("");
    const normalized = normalizeSpotifyTrackUrl(url);
    if (!normalized) { setPlaylistMessage("Paste a Spotify track link (not an album or playlist)."); return; }
    if (playlist.some((item) => normalizeSpotifyTrackUrl(item.url) === normalized)) { setPlaylistMessage("That track is already in the queue."); return; }
    const result = await supabase.from("playlist_items").insert({ league_id:LEAGUE_ID, url:normalized, requested_by:"Draft guest" }).select().single();
    if (result.error) { setPlaylistMessage("Could not add that track yet."); return; }
    setPlaylist((current) => [...current, result.data]);
    setUrl("");
    setPlaylistMessage("Added. It will play automatically in queue order.");
  };

  return (
    <div className="audio-manager">
      <button className={`sound-toggle audio-director ${enabled ? "enabled" : ""}`} onClick={toggle} title={enabled ? "Mute draft music and event cues" : "Start draft music and event cues"}>
        {enabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        <span><b>{enabled ? playerState.playing ? "MUSIC PLAYING" : "SOUND ON" : "SOUND OFF"}</b><small>{enabled ? playerState.message : "CLICK TO START"}</small></span>
        <ListMusic size={13} className={playerState.playing ? "audio-pulse" : ""} />
      </button>
      <button className="audio-settings" onClick={() => setOpen((value) => !value)} aria-label="Open audio manager"><SlidersHorizontal /></button>
      <div className={`audio-popover ${open ? "open" : "closed"}`} aria-hidden={!open}>
        <header><div><span>LIVE SHOW AUDIO</span><b>Spotify auto queue</b></div><button onClick={() => setOpen(false)} aria-label="Close audio manager"><X /></button></header>
        <div className="audio-rule"><span>EVENT CUES</span><b>Pick in · Reveal · Start · End · Announcement</b><small>{lastCue ? `Last cue: ${lastCue}` : "Music pauses for each cue, then resumes automatically."}</small></div>
        <label>Event sound effects <strong>{mix.sfx}%</strong><input type="range" min="0" max="100" value={mix.sfx} onChange={(event) => setMix({ ...mix, sfx:Number(event.target.value) })} /></label>
        <SpotifyQueuePlayer ref={spotifyRef} items={playlist} enabled={enabled} onState={handlePlayerState} />
        <div className="playlist-manager">
          <span>ADD TO AUTO QUEUE</span>
          <p>Paste a Spotify track link. Requests join the live queue and advance automatically.</p>
          <div><input value={url} onChange={(event) => setUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void addTrack(); }} placeholder="https://open.spotify.com/track/…" /><button onClick={addTrack} aria-label="Add Spotify track"><Plus /></button></div>
          {playlistMessage && <small>{playlistMessage}</small>}
        </div>
      </div>
    </div>
  );
}
