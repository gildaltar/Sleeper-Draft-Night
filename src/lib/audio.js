export function announcementCue(announcement) {
  if (!announcement || announcement.sound === "none") return null;
  if (["announcement", "alert", "trade", "round-break", "celebration"].includes(announcement.sound)) return announcement.sound;
  if (announcement.sound === "fanfare") return announcement.type === "celebration" ? "celebration" : "round-break";
  if (announcement.type === "celebration") return "celebration";
  if (announcement.type === "round") return "round-break";
  if (announcement.type === "trade") return "trade";
  if (announcement.type === "announcement") return "announcement";
  return "alert";
}

export function isDraftComplete(status = "") {
  return ["complete", "draft_complete", "finished"].includes(String(status).toLowerCase());
}

export function isDraftLive(status = "") {
  return ["drafting", "in_progress"].includes(String(status).toLowerCase());
}
