import { Music2, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const AUDIO_KEY = "sdn-audio-enabled-v2";

function tone(context, destination, frequency, start, duration, volume = 0.04, type = "sine") {
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
  const contextRef = useRef(null);
  const musicRef = useRef(null);
  const previousCount = useRef(picks.length);
  const previousStatus = useRef(draftStatus);
  const previousCue = useRef(cue);

  const ensureAudio = () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    if (!contextRef.current) contextRef.current = new AudioContext();
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
    const master = context.createGain();
    master.gain.value = 0.018;
    master.connect(context.destination);
    const nodes = [55, 82.41].map((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = index ? "triangle" : "sine";
      oscillator.frequency.value = frequency;
      gain.gain.value = index ? 0.28 : 0.42;
      oscillator.connect(gain).connect(master);
      oscillator.start();
      return oscillator;
    });
    const pulse = () => {
      const now = context.currentTime;
      [164.81, 196, 246.94].forEach((frequency, index) => tone(context, master, frequency, now + index * 0.22, 0.5, 0.18, "triangle"));
    };
    pulse();
    musicRef.current = { nodes, interval: window.setInterval(pulse, 4200) };
  };

  const playFanfare = (context) => {
    const now = context.currentTime;
    [196, 246.94, 293.66, 392].forEach((frequency, index) => tone(context, context.destination, frequency, now + index * 0.13, 0.58, 0.055, "sawtooth"));
  };

  const playPick = (context) => {
    const now = context.currentTime;
    [523.25, 659.25, 783.99].forEach((frequency, index) => tone(context, context.destination, frequency, now + index * 0.085, 0.44, 0.07, "triangle"));
    tone(context, context.destination, 1046.5, now + 0.31, 0.72, 0.065, "sine");
  };

  const playAlert = (context) => {
    const now = context.currentTime;
    tone(context, context.destination, 220, now, 0.28, 0.05, "square");
    tone(context, context.destination, 293.66, now + 0.18, 0.5, 0.05, "square");
  };

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    window.localStorage.setItem(AUDIO_KEY, String(next));
    if (next) {
      const context = ensureAudio();
      if (context) { playFanfare(context); startMusic(context); }
    } else stopMusic();
  };

  useEffect(() => {
    if (!enabled) return undefined;
    const context = ensureAudio();
    if (context && !musicRef.current) startMusic(context);
    return undefined;
  }, [enabled]);

  useEffect(() => {
    if (enabled && picks.length > previousCount.current) playPick(ensureAudio());
    previousCount.current = picks.length;
  }, [enabled, picks.length]);

  useEffect(() => {
    if (enabled && draftStatus === "in_progress" && previousStatus.current !== "in_progress") playFanfare(ensureAudio());
    previousStatus.current = draftStatus;
  }, [draftStatus, enabled]);

  useEffect(() => {
    if (enabled && cue && cue !== previousCue.current) playAlert(ensureAudio());
    previousCue.current = cue;
  }, [cue, enabled]);

  useEffect(() => () => {
    stopMusic();
    void contextRef.current?.close?.();
  }, []);

  return (
    <button className={`sound-toggle audio-director ${enabled ? "enabled" : ""}`} onClick={toggle} title={enabled ? "Mute draft music and event cues" : "Start draft music and event cues"}>
      {enabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
      <span><b>{enabled ? "MUSIC + SFX" : "SOUND OFF"}</b><small>{enabled ? "LIVE MIX" : "CLICK TO START"}</small></span>
      {enabled && <Music2 size={13} className="audio-pulse" />}
    </button>
  );
}
