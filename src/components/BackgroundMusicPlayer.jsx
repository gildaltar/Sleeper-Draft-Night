import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import AppleMusicQueuePlayer from "./AppleMusicQueuePlayer";
import SpotifyQueuePlayer from "./SpotifyQueuePlayer";

const BackgroundMusicPlayer = forwardRef(function BackgroundMusicPlayer({items,enabled,volume,onState},ref) {
  const playerRef = useRef(null);
  const [provider,setProvider] = useState({status:"loading",token:""});
  useEffect(() => {
    let active = true;
    fetch("/api/apple-music-token")
      .then(async (response) => ({ok:response.ok,status:response.status,data:await response.json().catch(() => ({}))}))
      .then(({ok,data}) => {
        if (!active) return;
        if (ok && data.developerToken) setProvider({status:"apple",token:data.developerToken});
        else setProvider({status:"spotify",token:""});
      })
      .catch(() => {if (active) setProvider({status:"spotify",token:""});});
    return () => {active = false;};
  },[]);
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
  return <><div className="music-provider-fallback"><b>Apple Music setup pending</b><span>Spotify remains active until the MusicKit developer key is added.</span></div><SpotifyQueuePlayer ref={playerRef} items={items} enabled={enabled} onState={(state) => onState?.({...state,provider:"spotify",configured:true})} /></>;
});

export default BackgroundMusicPlayer;
