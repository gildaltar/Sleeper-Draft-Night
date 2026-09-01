import { useCallback, useEffect, useRef, useState } from "react";

const instanceId = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const normalize = (value = "") => value.toLowerCase().replace(/[^a-z0-9]/g, "");

export function memberForParticipant(participant, members) {
  const participantName = normalize(participant?.displayName);
  return members.find(
    (member) =>
      participantName.includes(normalize(member.displayName)) ||
      participantName.includes(normalize(member.teamName)),
  );
}

async function getVideoToken(participantType, rosterId, password) {
  const response = await fetch("/api/zoom/video-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ participantType, rosterId, password, instanceId: instanceId() }),
  });
  const data = await response.json();
  if (!response.ok || !data.token) throw new Error(data.error || "Could not authorize team cameras");
  return data;
}

export function useZoomDisplay({ members, spectator = false, enabled = true }) {
  const clientRef = useRef(null);
  const destroyRef = useRef(null);
  const attached = useRef(new WeakMap());
  const connecting = useRef(false);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [participants, setParticipants] = useState([]);

  const refresh = useCallback(() => {
    setParticipants([...(clientRef.current?.getAllUser?.() || [])]);
  }, []);

  const connect = useCallback(async () => {
    if (!enabled || connecting.current || clientRef.current) return;
    connecting.current = true;
    setStatus("connecting");
    setMessage("Connecting the team camera wall…");
    try {
      const token = await getVideoToken(spectator ? "spectator" : "display");
      const { default: ZoomVideo } = await import("@zoom/videosdk");
      if (!ZoomVideo.checkSystemRequirements().video) throw new Error("This browser cannot render Zoom Video SDK video");
      const client = ZoomVideo.createClient();
      clientRef.current = client;
      destroyRef.current = ZoomVideo.destroyClient;
      await client.init("en-US", "Global", { patchJsMedia: true, stayAwake: true });
      const update = () => refresh();
      client.on("user-added", update);
      client.on("user-updated", update);
      client.on("user-removed", update);
      client.on("peer-video-state-change", update);
      client.on("connection-change", (event) => {
        if (event.state === "Reconnecting") setStatus("connecting");
        if (event.state === "Connected") setStatus("joined");
        if (event.state === "Closed" || event.state === "Fail") {
          clientRef.current = null;
          setStatus("error");
          setMessage(event.reason || "Camera wall disconnected");
        }
      });
      await client.join(token.topic, token.token, spectator ? "Spectator Broadcast" : "Draft Board");
      setStatus("joined");
      setMessage("");
      refresh();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not connect team cameras");
      clientRef.current = null;
    } finally {
      connecting.current = false;
    }
  }, [enabled, refresh, spectator]);

  useEffect(() => {
    connect();
    return () => {
      const client = clientRef.current;
      const destroy = destroyRef.current;
      clientRef.current = null;
      Promise.resolve(client?.leave?.(false))
        .catch(() => undefined)
        .finally(() => client ? Promise.resolve(destroy?.(client)).catch(() => undefined) : undefined);
    };
  }, [connect]);

  const attach = useCallback(async (userId, element, quality = 2) => {
    const client = clientRef.current;
    if (!client || !element || (attached.current.get(element) === userId && element.querySelector(".zoom-video-player"))) return;
    try {
      const video = await client.getMediaStream().attachVideo(userId, quality);
      if (video instanceof HTMLElement) {
        video.classList.add("zoom-video-player");
        element.querySelectorAll(".zoom-video-player").forEach((node) => node.remove());
        element.appendChild(video);
        attached.current.set(element, userId);
      }
    } catch {
      // A participant can turn video off between the state event and attachment.
    }
  }, []);

  const participantByRoster = new Map();
  for (const participant of participants) {
    const member = memberForParticipant(participant, members);
    if (member) participantByRoster.set(member.rosterId, participant);
  }
  return { status, message, participantByRoster, attach, reconnect: connect };
}

export async function startOwnerCamera({ member, mount, password, onStatus }) {
  onStatus?.("connecting", "Requesting camera and microphone…");
  const token = await getVideoToken("owner", member.rosterId, password);
  const { default: ZoomVideo } = await import("@zoom/videosdk");
  const requirements = ZoomVideo.checkSystemRequirements();
  if (!requirements.video || !requirements.audio) throw new Error("This browser does not support the camera and microphone features Zoom requires");
  const client = ZoomVideo.createClient();
  await client.init("en-US", "Global", { patchJsMedia: true, stayAwake: true });
  await client.join(token.topic, token.token, `Team ${member.displayName}`);
  const stream = client.getMediaStream();
  await stream.startAudio();
  await stream.startVideo();
  const current = client.getCurrentUserInfo();
  const video = await stream.attachVideo(current.userId, 3);
  if (video instanceof HTMLElement && mount) {
    video.classList.add("zoom-video-player");
    mount.replaceChildren(video);
  }
  onStatus?.("joined", "");
  return { client, destroy: () => ZoomVideo.destroyClient(client), stream };
}
