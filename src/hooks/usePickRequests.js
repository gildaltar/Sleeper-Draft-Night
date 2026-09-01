import { useCallback, useEffect, useState } from "react";
import { LEAGUE_ID } from "../lib/config";
import { supabase } from "../lib/supabase";

export function usePickRequests(enabled) {
  const [requests, setRequests] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!enabled) return;
    const result = await supabase
      .from("pick_requests")
      .select("*")
      .eq("league_id", LEAGUE_ID)
      .order("requested_at", { ascending: false })
      .limit(40);
    if (result.error) throw result.error;
    setRequests(result.data || []);
    setConnected(true);
    setError("");
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    reload().catch((requestError) => {
      setConnected(false);
      setError(requestError.message || "Pick-request queue unavailable");
    });
    const channel = supabase
      .channel(`pick-operator-${LEAGUE_ID}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pick_requests", filter: `league_id=eq.${LEAGUE_ID}` },
        () => void reload(),
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [enabled, reload]);

  const update = useCallback(async (id, patch) => {
    const terminal = ["confirmed", "rejected", "cancelled", "failed", "stale"].includes(patch.status);
    const result = await supabase
      .from("pick_requests")
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
        ...(terminal ? { completed_at: new Date().toISOString() } : {}),
      })
      .eq("id", id)
      .select()
      .single();
    if (result.error) throw result.error;
    setRequests((current) => current.map((item) => item.id === id ? result.data : item));
    return result.data;
  }, []);

  return { requests, connected, error, reload, update };
}
