import { ExternalLink, ListMusic, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { appleMusicSongId, normalizeAppleMusicTrackUrl } from "../lib/audio";

let musicKitPromise;
function loadMusicKit() {
  if (window.MusicKit) return Promise.resolve(window.MusicKit);
  if (musicKitPromise) return musicKitPromise;
  musicKitPromise = new Promise((resolve,reject) => {
    const existing = document.querySelector('script[data-sdn-musickit="true"]');
    if (existing) {
      const check = window.setInterval(() => {if (window.MusicKit) {window.clearInterval(check);resolve(window.MusicKit);}},50);
      window.setTimeout(() => {window.clearInterval(check);reject(new Error("MusicKit did not finish loading"));},10000);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://js-cdn.music.apple.com/musickit/v3/musickit.js";
    script.async = true;
    script.dataset.sdnMusickit = "true";
    script.onload = () => window.MusicKit ? resolve(window.MusicKit) : reject(new Error("MusicKit unavailable"));
    script.onerror = () => reject(new Error("MusicKit could not load"));
    document.head.appendChild(script);
  });
  return musicKitPromise;
}

const titleFromUrl = (value) => {
  try {
    const parts = new URL(value).pathname.split("/").filter(Boolean);
    const slug = parts.at(-2) || "Apple Music song";
    return slug.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  } catch { return "Apple Music song"; }
};

const AppleMusicQueuePlayer = forwardRef(function AppleMusicQueuePlayer({items,enabled,volume = 60,developerToken,onState},ref) {
  const musicRef = useRef(null);
  const authorizedRef = useRef(false);
  const [ready,setReady] = useState(false);
  const [playing,setPlaying] = useState(false);
  const [message,setMessage] = useState("Loading Apple Music…");
  const [currentIndex,setCurrentIndex] = useState(0);
  const queue = useMemo(() => items.flatMap((item) => {
    const url = normalizeAppleMusicTrackUrl(item.url);
    const songId = appleMusicSongId(item.url);
    return url && songId ? [{...item,url,songId}] : [];
  }),[items]);
  const queueRef = useRef(queue);
  queueRef.current = queue;

  const configureQueue = async () => {
    const music = musicRef.current;
    if (!music || !authorizedRef.current || !queueRef.current.length) return;
    await music.setQueue({songs:queueRef.current.map((item) => item.songId)});
    setCurrentIndex(0);
  };
  const authorizeAndPlay = async () => {
    const music = musicRef.current;
    if (!music) return;
    if (!authorizedRef.current) {
      setMessage("Authorize Apple Music in the sign-in window…");
      await music.authorize();
      authorizedRef.current = true;
      await configureQueue();
    }
    if (!queueRef.current.length) {setMessage("Queue is empty");return;}
    await music.play();
  };

  useImperativeHandle(ref,() => ({
    play:authorizeAndPlay,
    pause:() => musicRef.current?.pause(),
    resume:authorizeAndPlay,
    next:() => musicRef.current?.skipToNextItem(),
    previous:() => musicRef.current?.skipToPreviousItem(),
    setVolume:(value) => {if (musicRef.current) musicRef.current.volume = Math.max(0,Math.min(1,value));},
  }));

  useEffect(() => {
    let active = true;
    loadMusicKit().then(async (MusicKit) => {
      if (!active) return;
      await MusicKit.configure({developerToken,app:{name:"Stroudy Draft Night",build:"5.0.0"}});
      const music = MusicKit.getInstance();
      music.volume = volume / 100;
      musicRef.current = music;
      const events = MusicKit.Events || {};
      if (events.playbackStateDidChange) music.addEventListener(events.playbackStateDidChange,({state}) => {
        const isPlaying = [2,"playing"].includes(state);
        setPlaying(isPlaying);
        setMessage(isPlaying ? "Playing Apple Music" : "Apple Music ready");
      });
      if (events.nowPlayingItemDidChange) music.addEventListener(events.nowPlayingItemDidChange,({item}) => {
        const id = String(item?.id || "");
        const index = queueRef.current.findIndex((entry) => entry.songId === id);
        if (index >= 0) setCurrentIndex(index);
      });
      setReady(true);
      setMessage("Ready—press Sound On to authorize Apple Music.");
    }).catch((error) => setMessage(error.message || "Apple Music unavailable"));
    return () => {active = false;};
  },[developerToken]);

  useEffect(() => {if (musicRef.current) musicRef.current.volume = volume / 100;},[volume]);
  useEffect(() => {if (authorizedRef.current) void configureQueue();},[queue.map((item) => item.songId).join(",")]);
  useEffect(() => {if (!enabled) musicRef.current?.pause();},[enabled]);
  useEffect(() => {onState?.({ready,playing,message,current:queue[currentIndex],queueLength:queue.length,provider:"apple",configured:true});},[currentIndex,message,onState,playing,queue,ready]);

  if (!queue.length) return <div className="spotify-queue-empty apple-queue-empty"><ListMusic /><b>Apple Music queue is empty</b><span>Paste a song link below.</span></div>;
  const current = queue[currentIndex] || queue[0];
  return (
    <section className="spotify-queue-player apple-queue-player">
      <div className="apple-now-playing">
        <div className="apple-music-mark">♫</div>
        <div><span>{playing ? "NOW PLAYING" : ready ? "APPLE MUSIC READY" : "CONNECTING"}</span><b>{titleFromUrl(current.url)}</b><small>Request {currentIndex + 1} of {queue.length} · automatic queue</small></div>
        <div className="queue-controls"><button onClick={() => musicRef.current?.skipToPreviousItem()} aria-label="Previous track"><SkipBack /></button><button className="queue-play" onClick={() => playing ? musicRef.current?.pause() : authorizeAndPlay()} aria-label={playing ? "Pause background music" : "Play background music"}>{playing ? <Pause /> : <Play />}</button><button onClick={() => musicRef.current?.skipToNextItem()} aria-label="Next track"><SkipForward /></button></div>
      </div>
      <ol className="auto-queue-list">{queue.slice(0,10).map((item,index) => <li className={index === currentIndex ? "current" : ""} key={item.id}><strong>{index + 1}</strong><span><b>{titleFromUrl(item.url)}</b><small>{item.requested_by || "Draft guest"}</small></span><a href={item.url} target="apple-music-track" rel="noreferrer" aria-label="Open track in Apple Music"><ExternalLink /></a></li>)}</ol>
    </section>
  );
});

export default AppleMusicQueuePlayer;
