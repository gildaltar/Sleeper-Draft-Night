import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import AppleMusicQueuePlayer from "./AppleMusicQueuePlayer";

const BackgroundMusicPlayer = forwardRef(function BackgroundMusicPlayer({items,enabled,volume,onState},ref) {
  const playerRef = useRef(null);
  const onStateRef = useRef(onState);
  const [provider,setProvider] = useState({status:"loading",token:"",message:"Checking Apple Music…"});
  useEffect(() => {
    let active = true;
    fetch("/api/apple-music-token")
      .then(async (response) => ({ok:response.ok,status:response.status,data:await response.json().catch(() => ({}))}))
      .then(({ok,data}) => {
        if (!active) return;
        if (ok && data.developerToken) setProvider({status:"apple",token:data.developerToken,message:"Apple Music ready"});
        else setProvider({status:"setup",token:"",message:data.error || "Apple Music setup is incomplete"});
      })
      .catch(() => {if (active) setProvider({status:"setup",token:"",message:"Apple Music readiness check failed"});});
    return () => {active = false;};
  },[]);
  useEffect(() => {onStateRef.current = onState;},[onState]);
  useEffect(() => {
    if (provider.status === "setup") onStateRef.current?.({ready:false,playing:false,message:provider.message,provider:"apple",configured:false});
  },[provider]);
  useImperativeHandle(ref,() => ({
    play:() => playerRef.current?.play?.(),
    pause:() => playerRef.current?.pause?.(),
    resume:() => playerRef.current?.resume?.(),
    next:() => playerRef.current?.next?.(),
    previous:() => playerRef.current?.previous?.(),
    setVolume:(value) => playerRef.current?.setVolume?.(value),
  }));
  if (provider.status === "loading") return <div className="spotify-queue-empty"><b>Checking Apple Music…</b></div>;
  if (provider.status === "apple") return <AppleMusicQueuePlayer ref={playerRef} items={items} enabled={enabled} volume={volume} developerToken={provider.token} onState={onState} />;
  return <div className="music-provider-fallback"><b>Apple Music setup required</b><span>{provider.message}. Add the MusicKit developer credentials to enable subscription playback, queue controls, and the music volume slider.</span></div>;
});

export default BackgroundMusicPlayer;
