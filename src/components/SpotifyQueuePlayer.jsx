import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { ExternalLink, ListMusic, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { normalizeSpotifyTrackUrl } from "../lib/audio";

let spotifyApiPromise;

function loadSpotifyIframeApi() {
  if (window.__sdnSpotifyIframeApi) return Promise.resolve(window.__sdnSpotifyIframeApi);
  if (spotifyApiPromise) return spotifyApiPromise;
  spotifyApiPromise = new Promise((resolve, reject) => {
    const previousReady = window.onSpotifyIframeApiReady;
    window.onSpotifyIframeApiReady = (api) => {
      window.__sdnSpotifyIframeApi = api;
      previousReady?.(api);
      resolve(api);
    };
    const existing = document.querySelector('script[data-sdn-spotify="true"]');
    if (existing) return;
    const script = document.createElement("script");
    script.src = "https://open.spotify.com/embed/iframe-api/v1";
    script.async = true;
    script.dataset.sdnSpotify = "true";
    script.onerror = () => reject(new Error("Spotify player could not load"));
    document.head.appendChild(script);
  });
  return spotifyApiPromise;
}

function TrackTitle({ url }) {
  const [title, setTitle] = useState("Spotify track");
  useEffect(() => {
    let active = true;
    fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("metadata unavailable")))
      .then((data) => { if (active && data.title) setTitle(data.title); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [url]);
  return title;
}

const SpotifyQueuePlayer = forwardRef(function SpotifyQueuePlayer({ items, enabled, onState }, ref) {
  const mountRef = useRef(null);
  const controllerRef = useRef(null);
  const maxPositionRef = useRef(0);
  const advancingRef = useRef(false);
  const enabledRef = useRef(enabled);
  const onStateRef = useRef(onState);
  const queueRef = useRef([]);
  const currentIndexRef = useRef(0);
  const [currentId, setCurrentId] = useState(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState("Loading Spotify queue…");
  const [progress, setProgress] = useState({ position:0, duration:0 });

  const queue = useMemo(() => items.flatMap((item) => {
    const normalized = normalizeSpotifyTrackUrl(item.url);
    return normalized ? [{ ...item, url:normalized }] : [];
  }), [items]);
  const currentIndex = Math.max(0, queue.findIndex((item) => item.id === currentId));
  const current = queue[currentIndex] || null;
  const hasQueue = queue.length > 0;
  queueRef.current = queue;
  currentIndexRef.current = currentIndex;

  const move = (delta) => {
    const activeQueue = queueRef.current;
    if (!activeQueue.length) return;
    const nextIndex = (currentIndexRef.current + delta + activeQueue.length) % activeQueue.length;
    advancingRef.current = true;
    maxPositionRef.current = 0;
    const next = activeQueue[nextIndex];
    if (next.id === activeQueue[currentIndexRef.current]?.id) {
      controllerRef.current?.loadEntity?.(next.url);
      window.setTimeout(() => {
        advancingRef.current = false;
        if (enabledRef.current) controllerRef.current?.play?.();
      }, 250);
      return;
    }
    setCurrentId(next.id);
  };

  useImperativeHandle(ref, () => ({
    play: () => controllerRef.current?.play?.(),
    pause: () => controllerRef.current?.pause?.(),
    resume: () => controllerRef.current?.resume?.(),
    next: () => move(1),
    previous: () => move(-1),
  }));

  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { onStateRef.current = onState; }, [onState]);
  useEffect(() => {
    if (!queue.length) { setCurrentId(null); return; }
    if (!queue.some((item) => item.id === currentId)) setCurrentId(queue[0].id);
  }, [currentId, queue]);

  useEffect(() => {
    if (!mountRef.current || !queue.length || controllerRef.current) return undefined;
    let cancelled = false;
    loadSpotifyIframeApi()
      .then((api) => {
        if (cancelled || !mountRef.current) return;
        api.createController(mountRef.current, { url:current?.url || queue[0].url, width:"100%", height:80 }, (controller) => {
          if (cancelled) { controller.destroy?.(); return; }
          controllerRef.current = controller;
          controller.addListener("ready", () => {
            setReady(true);
            setMessage(enabledRef.current ? "Ready—press play if your browser blocked autoplay." : "Queue ready");
          });
          controller.addListener("playback_started", () => {
            setPlaying(true);
            setMessage("Playing");
          });
          controller.addListener("playback_update", (event) => {
            const data = event?.data || {};
            const position = Number(data.position || 0);
            const duration = Number(data.duration || 0);
            maxPositionRef.current = Math.max(maxPositionRef.current, position);
            setProgress({ position, duration });
            setPlaying(!data.isPaused && !data.isBuffering);
            const reachedEnd = duration > 0 && position >= duration - 900;
            const resetAfterEnd = duration > 0 && data.isPaused && position < 500 && maxPositionRef.current >= duration * 0.88;
            if ((reachedEnd || resetAfterEnd) && !advancingRef.current) move(1);
          });
          if (enabledRef.current) controller.play?.();
        });
      })
      .catch((error) => setMessage(error.message || "Spotify player unavailable"));
    return () => {
      cancelled = true;
      controllerRef.current?.destroy?.();
      controllerRef.current = null;
    };
  }, [hasQueue]);

  useEffect(() => {
    if (!controllerRef.current || !current?.url) return;
    maxPositionRef.current = 0;
    setProgress({ position:0, duration:0 });
    controllerRef.current.loadEntity?.(current.url);
    const timer = window.setTimeout(() => {
      advancingRef.current = false;
      if (enabledRef.current) controllerRef.current?.play?.();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [current?.url]);

  useEffect(() => {
    if (!controllerRef.current || !ready) return;
    if (enabled) controllerRef.current.play?.();
    else controllerRef.current.pause?.();
  }, [enabled, ready]);

  useEffect(() => {
    onStateRef.current?.({ ready, playing, message, current, queueLength:queue.length });
  }, [current?.id, message, playing, queue.length, ready]);

  if (!queue.length) return <div className="spotify-queue-empty"><ListMusic /><b>Queue is empty</b><span>Add a Spotify track link below.</span></div>;

  const percent = progress.duration ? Math.min(100, (progress.position / progress.duration) * 100) : 0;
  return (
    <section className="spotify-queue-player">
      <div className="spotify-embed" ref={mountRef} />
      <div className="queue-now-playing">
        <div><span>{playing ? "NOW PLAYING" : ready ? "READY" : "CONNECTING"}</span><b><TrackTitle url={current.url} /></b><small>Request {currentIndex + 1} of {queue.length} · auto-advance + loop</small></div>
        <div className="queue-controls"><button onClick={() => move(-1)} aria-label="Previous track"><SkipBack /></button><button className="queue-play" onClick={() => playing ? controllerRef.current?.pause?.() : controllerRef.current?.play?.()} aria-label={playing ? "Pause background music" : "Play background music"}>{playing ? <Pause /> : <Play />}</button><button onClick={() => move(1)} aria-label="Next track"><SkipForward /></button></div>
      </div>
      <i className="queue-progress"><b style={{ width:`${percent}%` }} /></i>
      <ol className="auto-queue-list">{queue.slice(0, 10).map((item, index) => <li className={item.id === current.id ? "current" : ""} key={item.id}><strong>{index + 1}</strong><span><TrackTitle url={item.url} /><small>{item.requested_by || "Draft guest"}</small></span><a href={item.url} target="spotify-track" rel="noreferrer" aria-label="Open track in Spotify"><ExternalLink /></a></li>)}</ol>
    </section>
  );
});

export default SpotifyQueuePlayer;
