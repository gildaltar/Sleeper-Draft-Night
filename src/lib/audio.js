const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;

export function normalizeSpotifyTrackUrl(value = "") {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.hostname !== "open.spotify.com") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0]?.startsWith("intl-")) parts.shift();
    if (parts[0] === "embed") parts.shift();
    if (parts[0] !== "track" || !SPOTIFY_ID.test(parts[1] || "")) return null;
    return `https://open.spotify.com/track/${parts[1]}`;
  } catch {
    return null;
  }
}

export function announcementCue(announcement) {
  if (!announcement || announcement.sound === "none") return null;
  if (["announcement", "alert", "fanfare"].includes(announcement.sound)) return announcement.sound;
  if (announcement.type === "celebration" || announcement.type === "round") return "fanfare";
  if (announcement.type === "announcement") return "announcement";
  return "alert";
}

export function isDraftComplete(status = "") {
  return ["complete", "draft_complete", "finished"].includes(String(status).toLowerCase());
}
