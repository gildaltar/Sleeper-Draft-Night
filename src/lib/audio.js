const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;
const APPLE_ID = /^\d{5,20}$/;

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

export function appleMusicSongId(value = "") {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.hostname !== "music.apple.com") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 4 || !/^[a-z]{2}$/i.test(parts[0])) return null;
    if (parts[1] === "song" && APPLE_ID.test(parts.at(-1) || "")) return parts.at(-1);
    const itemId = url.searchParams.get("i");
    return APPLE_ID.test(itemId || "") ? itemId : null;
  } catch {
    return null;
  }
}

export function normalizeAppleMusicTrackUrl(value = "") {
  const songId = appleMusicSongId(value);
  if (!songId) return null;
  const url = new URL(value.trim());
  url.protocol = "https:";
  url.hostname = "music.apple.com";
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) if (key !== "i") url.searchParams.delete(key);
  return url.toString();
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
