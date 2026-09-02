import { useCallback, useEffect, useMemo, useState } from "react";
import { LEAGUE_ID } from "../lib/config";
import { supabase } from "../lib/supabase";

export const AUDIO_CUES = [
  {id:"opening",label:"Opening fanfare",description:"Room open / welcome"},
  {id:"pick-in",label:"Pick is in",description:"Official pick detected"},
  {id:"pick-reveal",label:"Pick reveal",description:"Player reveal follows"},
  {id:"draft-start",label:"Draft start",description:"Sleeper changes to live"},
  {id:"draft-end",label:"Draft complete",description:"Final pick confirmed"},
  {id:"announcement",label:"Announcement",description:"General commissioner message"},
  {id:"alert",label:"Urgent alert",description:"Important interruption"},
  {id:"trade",label:"Trade alert",description:"Trade overlay"},
  {id:"round-break",label:"Round break",description:"End of round"},
  {id:"celebration",label:"Celebration",description:"Special moment"},
];

const cleanName = (name = "sound") => name.replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-90) || "sound";
const inferredMime = (name = "") => ({mp3:"audio/mpeg",wav:"audio/wav",m4a:"audio/mp4",aac:"audio/aac",ogg:"audio/ogg",webm:"audio/webm",flac:"audio/flac"})[name.split(".").pop()?.toLowerCase()] || "";
export const eventAudioMaxSeconds = (cue) => ({opening:120,"pick-in":12,"pick-reveal":20,"draft-start":30,"draft-end":60,announcement:30,alert:20,trade:30,"round-break":45,celebration:60})[cue] || 30;
export const audioFileMimeType = (file) => file?.type?.startsWith("audio/") ? file.type : inferredMime(file?.name);
const audioDuration = (file) => new Promise((resolve) => {
  const player = document.createElement("audio");const url = URL.createObjectURL(file);let settled = false;let timer;
  const finish = (value) => {if (settled) return;settled = true;window.clearTimeout(timer);URL.revokeObjectURL(url);player.removeAttribute("src");resolve(value);};
  player.preload = "metadata";player.onloadedmetadata = () => finish(Number(player.duration));player.onerror = () => finish(null);player.src = url;
  timer = window.setTimeout(() => finish(null),5000);
});

export function useAudioCues() {
  const [rows,setRows] = useState([]);const [loading,setLoading] = useState(true);const [busyCue,setBusyCue] = useState("");const [error,setError] = useState("");
  const load = useCallback(async () => {
    const result = await supabase.from("audio_cues").select("cue,file_name,storage_path,public_url,mime_type,updated_at").eq("league_id",LEAGUE_ID);
    if (result.error) {setError(result.error.message);setLoading(false);return;}
    setRows(result.data || []);setError("");setLoading(false);
  },[]);
  useEffect(() => {
    void load();
    const channel = supabase.channel(`audio-cues-${LEAGUE_ID}`).on("postgres_changes",{event:"*",schema:"public",table:"audio_cues",filter:`league_id=eq.${LEAGUE_ID}`},() => void load()).subscribe();
    return () => {void supabase.removeChannel(channel);};
  },[load]);
  const byCue = useMemo(() => new Map(rows.map((row) => [row.cue,row])),[rows]);
  const upload = useCallback(async (cue,file) => {
    setBusyCue(cue);setError("");let uploadedPath = "";
    try {
      const mimeType = audioFileMimeType(file);
      if (!mimeType) throw new Error("Choose an MP3, WAV, M4A, AAC, OGG, WebM, or FLAC audio file.");
      if (!file.size) throw new Error("That audio file is empty.");
      if (file.size > 15 * 1024 * 1024) throw new Error("Audio files must be 15 MB or smaller.");
      const duration = await audioDuration(file);const maximum = eventAudioMaxSeconds(cue);
      if (Number.isFinite(duration) && duration > maximum) throw new Error(`${AUDIO_CUES.find((item) => item.id === cue)?.label || "This cue"} must be ${maximum} seconds or shorter.`);
      const previous = byCue.get(cue);uploadedPath = `${LEAGUE_ID}/${cue}/${Date.now()}-${cleanName(file.name)}`;
      const stored = await supabase.storage.from("draft-audio").upload(uploadedPath,file,{contentType:mimeType,cacheControl:"3600",upsert:false});if (stored.error) throw stored.error;
      const {data:{publicUrl}} = supabase.storage.from("draft-audio").getPublicUrl(uploadedPath);const {data:{user}} = await supabase.auth.getUser();
      const saved = await supabase.from("audio_cues").upsert({league_id:LEAGUE_ID,cue,file_name:file.name,storage_path:uploadedPath,public_url:publicUrl,mime_type:mimeType,updated_at:new Date().toISOString(),updated_by:user?.id || null},{onConflict:"league_id,cue"});
      if (saved.error) throw saved.error;
      if (previous?.storage_path && previous.storage_path !== uploadedPath) await supabase.storage.from("draft-audio").remove([previous.storage_path]);
      await load();
    } catch (uploadError) {if (uploadedPath) await supabase.storage.from("draft-audio").remove([uploadedPath]);setError(uploadError.message || "Upload failed");throw uploadError;} finally {setBusyCue("");}
  },[byCue,load]);
  const remove = useCallback(async (cue) => {
    setBusyCue(cue);setError("");
    try {const previous = byCue.get(cue);const deleted = await supabase.from("audio_cues").delete().eq("league_id",LEAGUE_ID).eq("cue",cue);if (deleted.error) throw deleted.error;if (previous?.storage_path) await supabase.storage.from("draft-audio").remove([previous.storage_path]);await load();}
    catch (removeError) {setError(removeError.message || "Could not remove sound");throw removeError;} finally {setBusyCue("");}
  },[byCue,load]);
  return {byCue,loading,busyCue,error,upload,remove,reload:load};
}
