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

export function isDraftLive(status = "") {
  return ["drafting", "in_progress"].includes(String(status).toLowerCase());
}
