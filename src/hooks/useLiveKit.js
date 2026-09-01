import { useCallback, useEffect, useRef, useState } from "react";
import { LEAGUE_ID } from "../lib/config";
import { supabase } from "../lib/supabase";

const parseMetadata = (participant) => {
  try { return JSON.parse(participant?.metadata || "{}"); }
  catch { return {}; }
};

export async function startOwnerCamera({ rosterId, mount, onStatus }) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser cannot access a camera. Use Safari or Chrome over HTTPS.");
  onStatus?.("connecting","Requesting native camera and microphone permission…");
  const stream = await navigator.mediaDevices.getUserMedia({
    video:{facingMode:"user",width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}},
    audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},
  });
  const preview = document.createElement("video");
  preview.className = "native-camera-preview";
  preview.autoplay = true;
  preview.muted = true;
  preview.playsInline = true;
  preview.srcObject = stream;
  mount?.replaceChildren(preview);
  await preview.play().catch(() => undefined);
  onStatus?.("preview","Camera and microphone are ready on this device. Connecting the broadcast relay…");

  const session = {
    stream, preview, room:null, configured:false,
    setMicrophone(enabled) { stream.getAudioTracks().forEach((track) => { track.enabled = enabled; }); },
    setCamera(enabled) { stream.getVideoTracks().forEach((track) => { track.enabled = enabled; }); },
    async destroy() {
      this.room?.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      preview.srcObject = null;
      preview.remove();
    },
  };

  const {data:{session:authSession}} = await supabase.auth.getSession();
  const response = await fetch("/api/livekit-token",{
    method:"POST",
    headers:{"content-type":"application/json",...(authSession?.access_token ? {authorization:`Bearer ${authSession.access_token}`} : {})},
    body:JSON.stringify({role:"owner",leagueId:LEAGUE_ID,rosterId:Number(rosterId)}),
  });
  const tokenData = await response.json().catch(() => ({}));
  if (response.status === 503 || tokenData.configured === false) {
    onStatus?.("preview","Device preview is ready. Add the LiveKit project credentials to send it to the broadcast.");
    return session;
  }
  if (!response.ok) {
    await session.destroy();
    throw new Error(tokenData.error || "Camera relay authorization failed");
  }

  const {Room,RoomEvent,Track,VideoPresets} = await import("livekit-client");
  const room = new Room({adaptiveStream:true,dynacast:true,videoCaptureDefaults:{resolution:VideoPresets.h720.resolution}});
  session.room = room;
  room.on(RoomEvent.Disconnected,() => onStatus?.("preview","Relay disconnected. Your local preview is still active."));
  room.on(RoomEvent.Reconnecting,() => onStatus?.("connecting","Reconnecting camera relay…"));
  room.on(RoomEvent.Reconnected,() => onStatus?.("joined","Camera and microphone are live in the broadcast room."));
  await room.connect(tokenData.serverUrl,tokenData.token,{autoSubscribe:false});
  const [videoTrack] = stream.getVideoTracks();
  const [audioTrack] = stream.getAudioTracks();
  if (videoTrack) await room.localParticipant.publishTrack(videoTrack,{source:Track.Source.Camera,simulcast:true});
  if (audioTrack) await room.localParticipant.publishTrack(audioTrack,{source:Track.Source.Microphone});
  session.configured = true;
  onStatus?.("joined","Camera and microphone are live in the broadcast room.");
  return session;
}

export function useLiveKitDisplay({enabled = true}) {
  const roomRef = useRef(null);
  const trackEnumRef = useRef(null);
  const [mediaByRoster,setMediaByRoster] = useState(() => new Map());
  const [message,setMessage] = useState("");
  const [connected,setConnected] = useState(false);

  useEffect(() => {
    if (!enabled) {
      roomRef.current?.disconnect();
      roomRef.current = null;
      setMediaByRoster(new Map());
      setConnected(false);
      setMessage("");
      return undefined;
    }
    let cancelled = false;
    let room;
    const refresh = () => {
      if (!room || cancelled) return;
      const next = new Map();
      for (const participant of room.remoteParticipants.values()) {
        const rosterId = Number(parseMetadata(participant).rosterId);
        if (!Number.isInteger(rosterId)) continue;
        const camera = participant.getTrackPublication(trackEnumRef.current.Source.Camera);
        const microphone = participant.getTrackPublication(trackEnumRef.current.Source.Microphone);
        next.set(rosterId,{participant,cameraOn:Boolean(camera?.track && !camera.isMuted),muted:!microphone?.track || microphone.isMuted});
      }
      setMediaByRoster(next);
    };
    const connect = async () => {
      try {
        const response = await fetch("/api/livekit-token",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({role:"viewer",leagueId:LEAGUE_ID})});
        const tokenData = await response.json().catch(() => ({}));
        if (response.status === 503 || tokenData.configured === false) {
          setMessage("LiveKit relay setup is still required before team cameras can appear.");
          return;
        }
        if (!response.ok) throw new Error(tokenData.error || "Camera relay token failed");
        const {Room,RoomEvent,Track} = await import("livekit-client");
        trackEnumRef.current = Track;
        room = new Room({adaptiveStream:true,dynacast:true});
        roomRef.current = room;
        [RoomEvent.ParticipantConnected,RoomEvent.ParticipantDisconnected,RoomEvent.TrackSubscribed,RoomEvent.TrackUnsubscribed,RoomEvent.TrackMuted,RoomEvent.TrackUnmuted,RoomEvent.ParticipantMetadataChanged].forEach((event) => room.on(event,refresh));
        room.on(RoomEvent.Reconnecting,() => setMessage("Team cameras are reconnecting…"));
        room.on(RoomEvent.Reconnected,() => {setConnected(true);setMessage("");refresh();});
        room.on(RoomEvent.Disconnected,() => {setConnected(false);setMessage("Team camera room disconnected.");});
        await room.connect(tokenData.serverUrl,tokenData.token,{autoSubscribe:true});
        if (cancelled) { room.disconnect(); return; }
        setConnected(true);
        setMessage("");
        refresh();
      } catch (error) {
        if (!cancelled) {
          setConnected(false);
          setMessage(error.message || "Team cameras could not connect");
        }
      }
    };
    void connect();
    return () => {
      cancelled = true;
      room?.disconnect();
      if (roomRef.current === room) roomRef.current = null;
    };
  }, [enabled]);

  const attach = useCallback((participant,mount) => {
    if (!participant || !mount || !trackEnumRef.current) return () => undefined;
    const publication = participant.getTrackPublication(trackEnumRef.current.Source.Camera);
    const track = publication?.track;
    if (!track) return () => undefined;
    mount.querySelectorAll(".livekit-video-player").forEach((node) => node.remove());
    const element = track.attach();
    element.classList.add("livekit-video-player");
    element.playsInline = true;
    mount.appendChild(element);
    return () => {
      track.detach(element);
      element.remove();
    };
  },[]);

  return {mediaByRoster,message,connected,attach};
}
